import http from 'k6/http';
import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

/** ===================== ENV / PARAMS ===================== **/
const TOKEN = (__ENV.ACCESS_TOKEN || '').trim();
if (!TOKEN) throw new Error('Defina -e ACCESS_TOKEN="token"');

const BATCH_RATE = parseInt(__ENV.BATCH_RATE || '3', 10);   // quantos POSTs por janela
const TIME_UNIT  = __ENV.TIME_UNIT  || '2s';                 // janela de disparo (ex.: 2s, 5s…)
const DURATION   = __ENV.TEST_DURATION || '1m';              // duração total do cenário
const POLL_INTERVAL_MS = parseInt(__ENV.POLL_INTERVAL_MS || '800', 10);
const MAX_WAIT_MS      = parseInt(__ENV.MAX_WAIT_MS || '120000', 10); // timeout por task (E2E)

const BASE = `${__ENV.BASE_URL || 'http://localhost:8000'}/conn`;
const RESULT_URL = (taskId) => `${BASE}/llm/resultado-task/${taskId}/`;

/** ===================== TARGETS & PAYLOADS ===================== **/
const ENDPOINTS = {
    planos: {
        postUrl: `${BASE}/planos/criar/`,
        body: () => JSON.stringify({
            titulo: 'Teste',
            componente: 10,
            anoEscolar: '1 EM',
            habilidade: 3358,
            competencias_gerais: [2, 3],
            competencias_especificas: [11],
            metodologia: 7,
            observacao: '',
        }),
    },
    listas: {
        postUrl: `${BASE}/atividades/criar-lista/`,
        body: () => JSON.stringify({
            nomeLista: 'Codex',
            habilidade_ids: [3382],
            anoEscolar: '2 EM',
            numQuestoes: 12,
            dificuldade: 2,
            tiposSelecionados: ['objetiva', 'discursiva'],
            userEmail: 'rogeraldino.feitosa@gmail.com',
            componente: 'Matemática',
        }),
    },
    resumos: {
        postUrl: `${BASE}/resumos/criar/`,
        body: () => JSON.stringify({
            titulo: 'Lista Async',
            anoEscolar: '2 EM',
            componente: 'Matemática',
            habilidade: 3391,
            assunto: '',
        }),
    },
};

/** ===================== MÉTRICAS ===================== **/
// Por endpoint
const postDuration = makeTrendPerKey('_post_duration_ms');
const e2eDuration  = makeTrendPerKey('_e2e_duration_ms');
const waitDuration = makeTrendPerKey('_wait_ms');
const pendingSize  = makeTrendPerKey('_pending_size');

const post202Count = makeCounterPerKey('_post_202');
const post200Count = makeCounterPerKey('_post_200');
const postOtherCnt = makeCounterPerKey('_post_other');
const e2eSuccess   = makeRatePerKey('_e2e_success');
const e2eFailCnt   = makeCounterPerKey('_e2e_fail');

function makeTrendPerKey(suffix) {
    const obj = {};
    for (const k of Object.keys(ENDPOINTS)) obj[k] = new Trend(`${k}${suffix}`, true);
    return obj;
}
function makeCounterPerKey(suffix) {
    const obj = {};
    for (const k of Object.keys(ENDPOINTS)) obj[k] = new Counter(`${k}${suffix}`);
    return obj;
}
function makeRatePerKey(suffix) {
    const obj = {};
    for (const k of Object.keys(ENDPOINTS)) obj[k] = new Rate(`${k}${suffix}`);
    return obj;
}

/** ===================== SCENÁRIOS ===================== **/
export const options = {
    scenarios: {
        planos:  { executor: 'constant-vus', vus: 1, duration: DURATION, exec: 'runner_planos'  },
        listas:  { executor: 'constant-vus', vus: 1, duration: DURATION, exec: 'runner_listas'  },
        resumos: { executor: 'constant-vus', vus: 1, duration: DURATION, exec: 'runner_resumos' },
    },
};

/** ===================== CORE ===================== **/
function headers() {
    return {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `access_token=${TOKEN}`,
        },
        redirects: 0,
    };
}

// POST → { status, taskId|null, startedAt, body }
function startGeneration(epKey) {
    const ep = ENDPOINTS[epKey];
    const started = Date.now();
    const res = http.post(ep.postUrl, ep.body(), headers());
    postDuration[epKey].add(Date.now() - started);

    if (res.status === 202) {
        post202Count[epKey].add(1);
        let taskId = null;
        try {
            const data = JSON.parse(res.body);
            taskId = data.task_id || data.taskId || null;
        } catch (_e) {}
        return { status: 202, taskId, startedAt: started, body: res.body };
    } else if (res.status === 200) {
        post200Count[epKey].add(1);
        return { status: 200, taskId: null, startedAt: started, body: res.body };
    } else {
        postOtherCnt[epKey].add(1);
        return { status: res.status, taskId: null, startedAt: started, body: res.body };
    }
}

// Faz polling até 200 / erro / timeout
function pollUntilDone(epKey, taskId, startedAt) {
    const deadline = startedAt + MAX_WAIT_MS;
    const url = RESULT_URL(taskId);

    while (Date.now() < deadline) {
        const t0 = Date.now();
        const res = http.get(url, headers());
        waitDuration[epKey].add(Date.now() - t0);

        if (res.status === 200) {
            e2eSuccess[epKey].add(true);
            e2eDuration[epKey].add(Date.now() - startedAt);
            return true;
        }
        if (res.status >= 400 && res.status !== 202) {
            e2eFailCnt[epKey].add(1);
            return false;
        }
        // 202 → ainda processando
        sleep(POLL_INTERVAL_MS / 1000);
    }
    // timeout
    e2eFailCnt[epKey].add(1);
    return false;
}

// Coordenador: a cada TIME_UNIT dispara até BATCH_RATE; faz polling round-robin
function runCoordinator(epKey) {
    const endAt = Date.now() + parseDurationMs(DURATION);
    let lastDispatch = 0;

    // token único → um “slot” pendente por vez.
    let pending = null; // { taskId, startedAt }

    while (Date.now() < endAt) {
        const now = Date.now();

        // 1) janela de disparo
        if (now - lastDispatch >= parseDurationMs(TIME_UNIT)) {
            let dispatched = 0;
            while (dispatched < BATCH_RATE) {
                // se ainda há 1 pendente, não dispare outro; queremos medir E2E real.
                if (pending) break;

                const { status, taskId, startedAt } = startGeneration(epKey);
                if (status === 202 && taskId) {
                    pending = { taskId, startedAt };
                    dispatched++;
                } else if (status === 200) {
                    // POST já finalizou (não usual aqui, mas contabiliza E2E “instantâneo”)
                    e2eSuccess[epKey].add(true);
                    e2eDuration[epKey].add(Date.now() - startedAt);
                    dispatched++;
                } else if (status >= 400) {
                    // erro direto
                    e2eFailCnt[epKey].add(1);
                    dispatched++;
                }
                // 202 sem taskId → nada a fazer (contabilizado em postOtherCnt no startGeneration)
            }
            lastDispatch = now;
        }

        // 2) polling do pendente
        if (pending) {
            pollUntilDone(epKey, pending.taskId, pending.startedAt);
            pending = null;
        }

        // 3) registra tamanho da fila pendente (0 ou 1 aqui)
        pendingSize[epKey].add(pending ? 1 : 0);

        sleep(0.2);
    }
}

/** ===================== ENTRIES ===================== **/
export function runner_planos()  { runCoordinator('planos');  }
export function runner_listas()  { runCoordinator('listas');  }
export function runner_resumos() { runCoordinator('resumos'); }

/** ===================== SUMMARY ===================== **/
export function handleSummary(data) {
    // helper para ler métricas agregadas
    const M = (name) => data.metrics[name] ? data.metrics[name].values : undefined;

    function lineCounts(key) {
        const ok200   = M(`${key}_post_200`)?.count || 0;
        const ok202   = M(`${key}_post_202`)?.count || 0;
        const other   = M(`${key}_post_other`)?.count || 0;
        const fails   = M(`${key}_e2e_fail`)?.count || 0;
        const succ    = M(`${key}_e2e_success`)?.passes || 0; // Rate usa passes/fails
        const postP95 = M(`${key}_post_duration_ms`)?.['p(95)']?.toFixed?.(0);
        const e2eP95  = M(`${key}_e2e_duration_ms`)?.['p(95)']?.toFixed?.(0);
        const waitP95 = M(`${key}_wait_ms`)?.['p(95)']?.toFixed?.(0);
        const peak    = M(`${key}_pending_size`)?.['p(100)'] || 0;

        return [
            `${key}:`,
            `  📬 POST 200.............: ${ok200}`,
            `  ⏳ POST 202 (enfilei)....: ${ok202}`,
            `  🚫 POST outros...........: ${other}`,
            `  ✅ Sucesso E2E...........: ${succ}`,
            `  ❌ Falhas E2E............: ${fails}`,
            `  ⏱️ POST p(95) ms.........: ${postP95 ?? '-'}`,
            `  ⏱️ E2E  p(95) ms.........: ${e2eP95 ?? '-'}`,
            `  ⏱️ Poll p(95) ms.........: ${waitP95 ?? '-'}`,
            `  🚀 Pico pendências.......: ${peak}`,
        ].join('\n');
    }

    console.log('\n=== RESUMO FINAL ===');
    console.log(lineCounts('planos'));
    console.log(lineCounts('listas'));
    console.log(lineCounts('resumos'));

    return {}; // sem arquivo de saída extra
}

/** ===================== UTILS ===================== **/
function parseDurationMs(s) {
    if (s.endsWith('ms')) return parseInt(s, 10);
    if (s.endsWith('s'))  return Math.floor(parseFloat(s) * 1000);
    if (s.endsWith('m'))  return Math.floor(parseFloat(s) * 60 * 1000);
    if (s.endsWith('h'))  return Math.floor(parseFloat(s) * 60 * 60 * 1000);
    return parseInt(s, 10);
}
