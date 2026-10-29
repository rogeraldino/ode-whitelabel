// frontend/src/services/Api.jsx
import axios from 'axios';
import axiosInstance from './axiosInstance.jsx'; // ajuste o caminho se precisar

const API_ENDPOINT = "/conn/";

// Instância simples do Axios para chamadas diretas.
const plainAxios = axios.create({
    baseURL: API_ENDPOINT,           // mesma URL do backend
    withCredentials: true,           // envia o cookie de refresh
});

const normalizeNivelEnsino = (valor) => {
    if (typeof valor !== 'string') return undefined;
    let texto = valor;
    if (typeof texto.normalize === 'function') {
        texto = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    const lower = texto.toLowerCase();
    if (lower.includes('medio')) return 'Médio';
    if (lower.includes('fundamental')) return 'Fundamental';
    return undefined;
};

const inferirNivelEnsino = (questao) => {
    if (!questao || typeof questao !== 'object') return undefined;

    const direto = normalizeNivelEnsino(questao.nivel_ensino || questao.nivelEnsino);
    if (direto) return direto;

    const doAno = normalizeNivelEnsino(questao?.ano?.nivel_ensino || questao?.ano?.nivelEnsino);
    if (doAno) return doAno;

    const daHabilidade = normalizeNivelEnsino(
        questao?.habilidade?.ano?.nivel_ensino || questao?.habilidade?.ano?.nivelEnsino,
    );
    if (daHabilidade) return daHabilidade;

    const codigoBncc = questao?.bncc || questao?.codigo_bncc || questao?.habilidade?.codigo_bncc;
    if (typeof codigoBncc === 'string' && codigoBncc.trim()) {
        const prefixo = codigoBncc.trim().slice(0, 2).toUpperCase();
        if (prefixo === 'EM') return 'Médio';
        if (prefixo === 'EF') return 'Fundamental';
    }

    if (questao.tipo === 'objetiva' && Array.isArray(questao.alternativas)) {
        const quantidadeAlternativas = questao.alternativas.filter(Boolean).length;
        if (quantidadeAlternativas >= 5) return 'Médio';
        if (quantidadeAlternativas >= 4) return 'Fundamental';
    }

    return undefined;
};

const prepararQuestaoParaLLM = (questao) => {
    if (!questao || typeof questao !== 'object') return questao;
    const payload = { ...questao };
    const nivel = inferirNivelEnsino(questao);
    if (nivel) payload.nivel_ensino = nivel;
    return payload;
};

export const aguardarResultadoDaTask = async (taskId, { intervalMs = 4000, timeoutMs = 120000 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const res = await axiosInstance.get(`llm/resultado-task/${taskId}/`, { validateStatus: () => true });
        if (res.status === 200) {
            // ⬇️ devolve o body inteiro (status, sucesso, quantidade, dados, etc.)
            return res.data;
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Timeout ao aguardar task');
};


export const baixarListaComQuestoes = async (dados) => {
    try {
        const response = await axiosInstance.post(
            'pdfgenerator/gerar-atividades-correcao/',
            dados,
            { responseType: 'blob' }
        );
        return response; // Ou return response.data, mas verifique como está usando depois!
    } catch (error) {
        console.error('Erro ao enviar lista com questões:', error);
        throw error;
    }
};

export const baixarCorrecaoAtividadeDocx = async (dados) => {
    try {
        const response = await axiosInstance.post(
            'docxgenerator/gerar-atividades-correcao-docx/',
            dados,
            { responseType: 'blob' }
        );
        return response;
    } catch (error) {
        console.error('Erro ao baixar DOCX:', error);
        throw error;
    }
};

export const baixarSolucoesAtividade = async (dados) => {
    try {
        const response = await axiosInstance.post(
            'pdfgenerator/gerar-solucoes/',
            dados,
            { responseType: 'blob' }
        );
        return response;
    } catch (error) {
        console.error('Erro ao baixar soluções:', error);
        throw error;
    }
};

export const enviarDadosLista = async (dados) => {
    try {
        const res = await axiosInstance.post('/atividades/criar-lista/', dados);
        const taskId = res.data?.task_id;

        // aguarda task encerrar
        const resultado = await aguardarResultadoDaTask(taskId);

        const listaUuid = resultado?.dados?.lista_uuid;
        if (!listaUuid) throw new Error('UUID da lista não encontrado após a task.');

        // faz um novo fetch com axiosInstance para garantir dados atualizados
        const listaCompleta = await buscarQuestoesDaLista(listaUuid);

        return { ...listaCompleta, uuid: listaUuid }; // Garante campo uuid presente
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        throw error;
    }
};

export const getMinhasListas = async () => {
    try {
        const response = await axiosInstance.get('atividades/minhas-listas/');
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar listas do usuário:', error);
        throw error;
    }
};

export const salvarDadosLista = async (dados) => {
    try {
        const response = await axiosInstance.post(`atividades/salvar-lista/`, dados);
        return response.data;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        throw error;
    }
};

export const buscarQuestoesDaLista = async (listaUuid) => {
    try {
        const response = await axiosInstance.get(`atividades/questoes/${listaUuid}/`);
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar questões da API:', error);
        throw error;
    }
};

export const fazerLogin = async (credentials) => {
    try {
        const response = await axios.post(`${API_ENDPOINT}auth/api/token/`, credentials, {
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        throw error;
    }
};

export const atualizarCredenciais = async (data) => {
    const response = await axiosInstance.post(`usuario/atualizar-credenciais/`, data, {
        withCredentials: true
    });
    return response.data;
};


export const buscarDadosUsuario = async () => {
    try {
        const res = await axiosInstance.get('usuario/me/');
        if (typeof res.data !== 'object') {
            console.error('API: Resposta não-JSON em /usuario/me/:', res.data);
            throw new Error('Resposta não-JSON em /usuario/me/');
        }
        console.log('API: buscarDadosUsuario - Sucesso. Dados:', res.data);
        return res.data;
    } catch (error) {
        console.error('API: Erro em buscarDadosUsuario:', error.response ? error.response.status : error.message);
        throw error;
    }
};

export const buscarHabilidades = async (searchTerm = '', anoEscolarId, componenteId) => {
    try {
        const params = new URLSearchParams();
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        if (anoEscolarId) {
            params.append('ano_escolar', anoEscolarId);
        }
        if (componenteId) {
            params.append('componente', componenteId);
        }
        const response = await axiosInstance.get(`conteudo/habilidades/`, { params });
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar habilidades:', error);
        throw error;
    }
};

export const listarComponentes = async () => {
    const res = await axiosInstance.get('conteudo/componentes/');
    return res.data;
};

export const listarCompetenciasGerais = async (componenteId) => {
    const params = {};
    if (componenteId) params.componente = componenteId;
    const res = await axiosInstance.get('conteudo/competencias-gerais/', { params });
    return res.data;
};

export const listarCompetenciasEspecificas = async (componenteId, nivelEnsino) => {
    const params = {};
    if (componenteId) params.componente = componenteId;
    if (nivelEnsino) params.nivel_ensino = nivelEnsino;
    const res = await axiosInstance.get('conteudo/competencias-especificas/', { params });
    return res.data;
};

export const competenciasDaHabilidade = async (habilidadeId) => {
    const res = await axiosInstance.get(`conteudo/habilidades/${habilidadeId}/competencias/`);
    return res.data;
};

export const refreshToken = async () => {
    console.log('API: Chamando refreshToken (endpoint: auth/api/token/refresh/).');
    try {
        const res = await plainAxios.post('auth/api/token/refresh/');
        console.log('API: refreshToken - Sucesso. Resposta:', res.data);
        return res.data;
    } catch (err) {
        console.error('API: Erro em refreshToken:', err.response ? err.response.status : err.message);
        throw err;
    }
};


export const logoutService = async () => {
    await axiosInstance.post(`auth/api/logout/`);
};

export const atualizarQuestao = async (questaoUuid, dados) => {
    try {
        const response = await axiosInstance.put(`atividades/questoes/atualizar/${questaoUuid}/`, dados);
        return response.data;
    } catch (error) {
        console.error('Erro ao atualizar questão:', error);
        throw error;
    }
};

export const criarQuestaoBackend = async (dadosQuestao) => {
    try {
        const response = await axiosInstance.post(`atividades/questoes/criar/`, dadosQuestao);
        return response.data;
    } catch (error) {
        console.error('Erro ao criar questão no backend:', error);
        throw error;
    }
};

export const buscarMaisQuestoes = async (listaUuid) => {
    try {
        // Endpoint para buscar questões gerais, passando listaUuid como query parameter
        const response = await axiosInstance.get(`atividades/questoes/geral/`, { params: { lista_uuid: listaUuid } });
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar mais questões:', error);
        throw error;
    }
};

export const simplificarQuestao = async (questao) => {
    console.log('API: iniciando simplificarQuestao');
    try {
        const payload = prepararQuestaoParaLLM(questao);
        const response = await axiosInstance.post('llm/simplificar-questao/', payload);
        console.log('API: simplificarQuestao sucesso');
        return response.data;
    } catch (error) {
        console.error('Erro ao simplificar questão:', error);
        throw error;
    }
};

export const dificultarQuestao = async (questao) => {
    console.log('API: iniciando dificultarQuestao');
    try {
        const payload = prepararQuestaoParaLLM(questao);
        const response = await axiosInstance.post('llm/dificultar-questao/', payload);
        console.log('API: dificultarQuestao sucesso');
        return response.data;
    } catch (error) {
        console.error('Erro ao dificultar questão:', error);
        throw error;
    }
};

export const contextualizarQuestao = async (questao) => {
    console.log('API: iniciando contextualizarQuestao');
    try {
        const payload = prepararQuestaoParaLLM(questao);
        const response = await axiosInstance.post('llm/contextualizar-questao/', payload);
        console.log('API: contextualizarQuestao sucesso');
        return response.data;
    } catch (error) {
        console.error('Erro ao contextualizar questão:', error);
        throw error;
    }
};

export const gerarMaisQuestoesLLM = async (contexto) => {
    console.log('API: iniciando gerarMaisQuestoesLLM');
    try {
        const response = await axiosInstance.post('llm/gerar-mais-questoes/', contexto);
        console.log('API: gerarMaisQuestoesLLM sucesso');
        // Backend devolve array de questões já persistidas com UUID real
        return response.data;
    } catch (error) {
        console.error('Erro ao gerar mais questões via LLM:', error);
        throw error;
    }
};


export const baixarUltimoModelo = async (listaUuid) => {
    try {
        const response = await axiosInstance.get(`pdfgenerator/baixar-ultima/${listaUuid}/`, { responseType: 'blob' });
        return response;
    } catch (error) {
        console.error('Erro ao baixar modelo:', error);
        throw error;
    }
};

export const baixarUltimaSolucao = async (listaUuid) => {
    try {
        const response = await axiosInstance.get(`pdfgenerator/baixar-solucoes-ultima/${listaUuid}/`, { responseType: 'blob' });
        return response;
    } catch (error) {
        console.error('Erro ao baixar solucoes:', error);
        throw error;
    }
};

export const buscarListasApi = async (termo = '', arquivadas = false) => {
    try {
        const params = { q: termo };
        if (arquivadas) {
            params.archived = true;
        }
        const response = await axiosInstance.get('atividades/listas/buscar/', { params });
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar listas inteligentes:', error);
        throw error;
    }
}

export const obterRespostasModelo = async (identificador) => {
    try {
        const response = await axiosInstance.get(`pdfgenerator/respostas/${identificador}/`);
        return response.data;
    } catch (error) {
        console.error('Erro ao obter respostas:', error);
        throw error;
    }
};

export const arquivarLista = async (listaUuid) => {
    try {
        const response = await axiosInstance.put(`atividades/listas/arquivar/${listaUuid}/`);
        return response.data;
    } catch (error) {
        console.error('Erro ao arquivar lista:', error);
        throw error;
    }
};

export const desarquivarLista = async (listaUuid) => {
    try {
        const response = await axiosInstance.put(`atividades/listas/desarquivar/${listaUuid}/`);
        return response.data;
    } catch (error) {
        console.error('Erro ao desarquivar lista:', error);
        throw error;
    }
};
  
export const apagarLista = async (listaUuid) => {
    try {
        const response = await axiosInstance.post(`atividades/lista-apagar/${listaUuid}/`);
        return response.data;
    } catch (error) {
        console.error('Erro ao apagar lista:', error);
        throw error;
    }
};


export const buscarExemploQuestao = async ({ componente, serie, habilidade, tipo }) => {
    try {
        const params = {};
        if (componente) params.componente = componente;
        if (serie) params.serie = serie;
        if (habilidade) params.habilidade = habilidade;
        if (tipo) params.tipo = tipo;
        const response = await axiosInstance.get('atividades/questoes/exemplo/', { params });
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar exemplo de questão:', error);
        throw error;
    }
};

export const listarMetodologias = async () => {
    const res = await axiosInstance.get('conteudo/metodologias/');
    return res.data;
};

export const listarAnosEscolares = async (componenteId) => {
    const params = {};
    if (componenteId) params.componente = componenteId;
    const res = await axiosInstance.get('conteudo/anos-escolares/', { params });
    return res.data;
};

// services/Api.jsx
export const criarPlanoDeAula = async (dados) => {
    console.log('criarPlanoDeAula chamado com dados:', dados);
    try {
        // 1) Enfileira (agora NÃO é mais blob)
        console.log('Enviando requisição para planos/criar/');
        const res = await axiosInstance.post('planos/criar/', dados);
        console.log('Resposta de planos/criar/:', res.data);
        const taskId = res.data?.task_id;
        if (!taskId) throw new Error('Task id não retornado em planos/criar/');

        // 2) Poll no endpoint compartilhado
        console.log('Aguardando resultado da task:', taskId);
        const resultado = await aguardarResultadoDaTask(taskId); // GET llm/resultado-task/<task_id>/
        console.log('Resultado da task:', resultado);

        const planoUuid = resultado?.dados?.plano_uuid;
        if (!planoUuid) throw new Error('UUID do plano não encontrado após a task.');

        // 3) Download do DOCX
        console.log('Baixando plano com UUID:', planoUuid);
        const blobResp = await baixarPlano(planoUuid); // já existe
        console.log('Plano baixado com sucesso');
        return blobResp; // retorno compatível com o fluxo atual (blob)
    } catch (error) {
        console.error('Erro em criarPlanoDeAula:', error);
        throw error;
    }
};


export const gerarResumo = async (dados) => {
    // 1) dispara criação e pega task_id
    const start = await axiosInstance.post('resumos/criar/', dados);
    const taskId = start.data?.task_id;
    if (!taskId) throw new Error('task_id ausente em /resumos/criar/');

    // 2) aguarda término (reuso do helper existente)
    const resultado = await aguardarResultadoDaTask(taskId, { timeoutMs: 120000 }); // resumos às vezes demoram mais

    // 3) lê o resumo_uuid do resultado
    const resumoUuid = resultado?.dados?.resumo_uuid;
    if (!resumoUuid) throw new Error('Resumo UUID ausente no resultado da task.');

    // 4) baixa o DOCX pronto (gera on-demand no backend)
    const response = await axiosInstance.get(`resumos/baixar/${resumoUuid}/`, { responseType: 'blob' });
    return response; // mantém compatível com o componente atual
};

export const listarMeusPlanos = async (archived = false) => {
    try {
        const res = await axiosInstance.get('planos/meus/', { params: { archived } });
        return res.data;
    } catch (err) {
        console.error('Erro ao buscar planos do usuário:', err);
        throw err;
    }
};

export const listarMeusResumos = async (archived = false) => {
    try {
        const res = await axiosInstance.get('resumos/meus/', { params: { archived } });
        return res.data;
    } catch (err) {
        console.error('Erro ao buscar resumos do usuário:', err);
        throw err;
    }
};

export const arquivarPlano = async (planoUuid) => {
    try {
        const res = await axiosInstance.put(`planos/arquivar/${planoUuid}/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao arquivar plano:', err);
        throw err;
    }
};

export const desarquivarPlano = async (planoUuid) => {
    try {
        const res = await axiosInstance.put(`planos/desarquivar/${planoUuid}/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao desarquivar plano:', err);
        throw err;
    }
};

export const deletarPlano = async (planoUuid) => {
    try {
        await axiosInstance.delete(`planos/deletar/${planoUuid}/`);
    } catch (err) {
        console.error('Erro ao excluir plano:', err);
        throw err;
    }
};

export const baixarPlano = async (planoUuid) => {
    const res = await axiosInstance.get(`planos/baixar/${planoUuid}/`, { responseType: 'blob' });
    return res;
};

export const arquivarResumo = async (resumoUuid) => {
    try {
        const res = await axiosInstance.put(`resumos/arquivar/${resumoUuid}/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao arquivar resumo:', err);
        throw err;
    }
};

export const desarquivarResumo = async (resumoUuid) => {
    try {
        const res = await axiosInstance.put(`resumos/desarquivar/${resumoUuid}/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao desarquivar resumo:', err);
        throw err;
    }
};

export const deletarResumo = async (resumoUuid) => {
    try {
        await axiosInstance.delete(`resumos/deletar/${resumoUuid}/`);
    } catch (err) {
        console.error('Erro ao excluir resumo:', err);
        throw err;
    }
};

export const baixarResumo = async (resumoUuid) => {
    const res = await axiosInstance.get(`resumos/baixar/${resumoUuid}/`, { responseType: 'blob' });
    return res;
};

// =========================== FUNÇÕES DE ADMINISTRAÇÃO ===========================

export const listarUsuariosAdmin = async () => {
    try {
        const res = await axiosInstance.get('usuario/admin/usuarios/');
        return res.data;
    } catch (err) {
        console.error('Erro ao listar usuários:', err);
        throw err;
    }
};

export const detalharUsuarioAdmin = async (usuarioId) => {
    try {
        const res = await axiosInstance.get(`usuario/admin/usuarios/${usuarioId}/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao detalhar usuário:', err);
        throw err;
    }
};

export const criarUsuarioAdmin = async (dados) => {
    try {
        const res = await axiosInstance.post('usuario/admin/usuarios/criar/', dados);
        return res.data;
    } catch (err) {
        console.error('Erro ao criar usuário:', err);
        throw err;
    }
};

export const atualizarUsuarioAdmin = async (usuarioId, dados) => {
    try {
        const res = await axiosInstance.put(`usuario/admin/usuarios/${usuarioId}/editar/`, dados);
        return res.data;
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        throw err;
    }
};

export const excluirUsuarioAdmin = async (usuarioId) => {
    try {
        const res = await axiosInstance.delete(`usuario/admin/usuarios/${usuarioId}/excluir/`);
        return res.data;
    } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        throw err;
    }
};

export const gerenciarComponentesUsuario = async (usuarioId, acao, componentesIds) => {
    try {
        const res = await axiosInstance.post(`usuario/admin/usuarios/${usuarioId}/componentes/`, {
            acao, // 'adicionar' ou 'remover'
            componentes_ids: componentesIds
        });
        return res.data;
    } catch (err) {
        console.error('Erro ao gerenciar componentes:', err);
        throw err;
    }
};

export const redefinirSenhaUsuario = async (usuarioId, novaSenha) => {
    try {
        const res = await axiosInstance.post(`usuario/admin/usuarios/${usuarioId}/redefinir-senha/`, {
            nova_senha: novaSenha
        });
        return res.data;
    } catch (err) {
        console.error('Erro ao redefinir senha:', err);
        throw err;
    }
};

export const listarPerfisAdmin = async () => {
    try {
        const res = await axiosInstance.get('usuario/admin/perfis/');
        return res.data;
    } catch (err) {
        console.error('Erro ao listar perfis:', err);
        throw err;
    }
};

export const listarComponentesAdmin = async () => {
    try {
        const res = await axiosInstance.get('usuario/admin/componentes/');
        return res.data;
    } catch (err) {
        console.error('Erro ao listar componentes:', err);
        throw err;
    }
};

export const adicionarMesesAcesso = async (usuarioId, meses) => {
    try {
        const res = await axiosInstance.post(`usuario/admin/usuarios/${usuarioId}/adicionar-meses/`, {
            meses: meses
        });
        return res.data;
    } catch (err) {
        console.error('Erro ao adicionar meses de acesso:', err);
        throw err;
    }
};
