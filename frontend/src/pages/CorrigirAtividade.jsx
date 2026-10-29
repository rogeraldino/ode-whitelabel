import React, { useState } from 'react';
import {
  Camera, Info, QrCode, Scan, X, CheckCircle, AlertCircle,
  Lightbulb, Smartphone, Target, Zap
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { obterRespostasModelo } from '../services/Api.jsx';
import { useAuth } from '../hooks/useAuth';
import '../style/corrigirAtividade.css';

export default function CorrigirAtividade() {
  const { user } = useAuth();
  if (user && !user.funcionalidades?.includes('corrigir-atividade')) {
    return <div className="featureLock">Funcionalidade não disponível para seu perfil.</div>;
  }

  const [cameraOpen, setCameraOpen] = useState(false);
  const [qrResult, setQrResult] = useState('');
  const [respostas, setRespostas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [solucaoAtual, setSolucaoAtual] = useState(null);
  const [showListaModal, setShowListaModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [dicasOpen, setDicasOpen] = useState(false);

  const mid = Math.ceil(respostas.length / 2);
  const chunkedRespostas = [respostas.slice(0, mid), respostas.slice(mid)];

  const handleOpenCamera = () => {
    setCameraOpen(true);
    setScanning(true);
    setError('');
  };

  const handleCloseCamera = () => {
    setCameraOpen(false);
    setScanning(false);
  };

  const handleMostrarSolucao = (solucao) => setSolucaoAtual(solucao);
  const fecharSolucao = () => setSolucaoAtual(null);
  const fecharListaModal = () => setShowListaModal(false);

  const handleScan = async (result) => {
    const value = Array.isArray(result)
        ? result[0]?.rawValue
        : result?.rawValue || result?.text || '';
    if (!value) return;

    setQrResult(value);
    setLoading(true);
    setError('');
    setScanning(false);

    const newScan = {
      id: Date.now(),
      code: value,
      timestamp: new Date().toLocaleString('pt-BR'),
      status: 'success',
    };
    setScanHistory((prev) => [newScan, ...prev.slice(0, 4)]);

    try {
      const data = await obterRespostasModelo(value);
      setRespostas(data.questoes || []);
      setShowListaModal(true);
      setCameraOpen(false);
    } catch {
      setError('Erro ao buscar respostas.');
      newScan.status = 'error';
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setScanHistory([]);
    setQrResult('');
  };

  return (
      <div className="page">
        <div className="content">
          {/* Card principal */}
          <div className="card">
            <div className="iconWrapper">
            <span className="iconBg">
              <QrCode className="icon" />
            </span>
            </div>

            <h2 className="title">Iniciar Correção</h2>
            <p className="desc">
              Aponte a câmera para o QR code presente na atividade do aluno para iniciar a correção automática.
            </p>

            {!cameraOpen && (
                <button
                    type="button"
                    onClick={handleOpenCamera}
                    className="primaryBtn"
                    disabled={loading}
                >
                  <Scan className="btnIcon" />
                  <span>Ler Atividade</span>
                </button>
            )}

            {cameraOpen && (
                <div className="scannerSection">
                  <div className="scannerHeader">
                    <h4 className="scannerTitle">Escaneando QR Code</h4>
                    <button
                        type="button"
                        onClick={handleCloseCamera}
                        className="secondaryBtn"
                        aria-label="Fechar câmera"
                    >
                      <X className="btnIcon" />
                      Fechar
                    </button>
                  </div>

                  <div className="scannerWrapper">
                    {scanning && (
                        <div className="scanningOverlay" aria-hidden="true">
                          <div className="scanningIndicator">
                            <div className="scanningDots">
                              <span></span><span></span><span></span>
                            </div>
                            <p>Posicione o QR code na área destacada</p>
                            <div className="scanningFrame">
                              <div className="corner topLeft"></div>
                              <div className="corner topRight"></div>
                              <div className="corner bottomLeft"></div>
                              <div className="corner bottomRight"></div>
                            </div>
                          </div>
                        </div>
                    )}

                    {/* controla tamanho pelo CSS */}
                    <div className="scannerMount" aria-label="Área do scanner">
                      <Scanner
                          onScan={handleScan}
                          onError={() => {
                            setError('Não foi possível acessar a câmera.');
                            setScanning(false);
                          }}
                          constraints={{ facingMode: 'environment' }}
                      />
                    </div>
                  </div>

                  {qrResult && (
                      <div className="qrResult" role="status" aria-live="polite">
                        <CheckCircle className="successIcon" />
                        <span>QR code lido com sucesso!</span>
                        <code className="qrValue">{qrResult}</code>
                      </div>
                  )}
                </div>
            )}

            {loading && (
                <div className="loading" aria-live="polite" aria-busy="true">
                  <div className="spinner"></div>
                  <p>Carregando respostas...</p>
                </div>
            )}

            {error && (
                <div className="error" role="alert">
                  <AlertCircle className="errorIcon" />
                  <p>{error}</p>
                </div>
            )}

            {scanHistory.length > 0 && (
                <div className="history">
                  <div className="historyHeader">
                    <h4>Histórico Recente</h4>
                    <button type="button" onClick={clearHistory} className="clearHistoryBtn">
                      Limpar
                    </button>
                  </div>

                  <div className="historyList">
                    {scanHistory.map((scan) => (
                        <div key={scan.id} className={`historyItem ${scan.status}`}>
                          <div className="historyCode">{scan.code}</div>
                          <div className="historyTime">{scan.timestamp}</div>
                          <div
                              className={`historyStatus ${scan.status}`}
                              aria-label={scan.status === 'success' ? 'sucesso' : 'erro'}
                          >
                            {scan.status === 'success' ? '✓' : '✗'}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
            )}

            {/* Modal de solução */}
            {solucaoAtual && (
                <div
                    className="overlay"
                    onClick={fecharSolucao}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Resolução"
                >
                  <div className="modal" onClick={(e) => e.stopPropagation()} role="document">
                    <h4 className="modalTitle">Resolução</h4>
                    <p className="modalBody">{solucaoAtual}</p>
                    <button type="button" className="primaryBtn" onClick={fecharSolucao}>
                      Fechar
                    </button>
                  </div>
                </div>
            )}

            {/* Modal de respostas */}
            {showListaModal && (
                <div
                    className="overlay"
                    onClick={fecharListaModal}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Respostas"
                >
                  <div className="listModal" onClick={(e) => e.stopPropagation()} role="document">
                    <h3 className="answersTitle">Respostas</h3>

                    <div className="answersColumns">
                      {chunkedRespostas.map((grupo, colIdx) => (
                          <ul key={colIdx} className="answersList">
                            {grupo.map((r, idx) => (
                                <li
                                    key={r.uuid}
                                    className="answerItem"
                                    onClick={() => handleMostrarSolucao(r.solucao)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) =>
                                        (e.key === 'Enter' || e.key === ' ') && handleMostrarSolucao(r.solucao)
                                    }
                                    aria-label={`Abrir solução da questão ${colIdx * mid + idx + 1}`}
                                >
                          <span className="answerQuestion">
                            {`Q${colIdx * mid + idx + 1} (${r.tipo}):\u00A0`}
                          </span>
                                  <span className="answerText">{r.resposta}</span>
                                </li>
                            ))}
                          </ul>
                      ))}
                    </div>

                    <button type="button" className="secondaryBtn" onClick={fecharListaModal}>
                      Fechar
                    </button>
                  </div>
                </div>
            )}
          </div>

          {/* Card lateral: Como Funciona */}
          <div className="howtoCard">
            <div className="howtoHeader">
              <Info className="howtoIcon" />
              <h3 className="howtoTitle">Como Funciona</h3>
            </div>

            <ol className="howtoList">
              <li className="howtoItem">
                <span className="stepNum">1</span>
                <div className="stepContent">
                  <strong>Prepare a Atividade</strong>
                  <p>Certifique-se de que o QR code está visível na folha</p>
                </div>
              </li>
              <li className="howtoItem">
                <span className="stepNum">2</span>
                <div className="stepContent">
                  <strong>Escaneie o Código</strong>
                  <p>Clique no botão e aponte a câmera para o QR code.</p>
                </div>
              </li>
              <li className="howtoItem">
                <span className="stepNum">3</span>
                <div className="stepContent">
                  <strong>Receba o Feedback</strong>
                  <p>O assistente analisará e fornecerá correções detalhadas.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* FAB Dicas */}
        <button
            type="button"
            className="fab"
            onClick={() => setDicasOpen(true)}
            title="Dicas para melhor resultado"
            aria-label="Abrir dicas para melhor resultado"
        >
          <Lightbulb className="fabIcon" />
        </button>

        {/* Modal de Dicas */}
        {dicasOpen && (
            <div
                className="tipsOverlay"
                onClick={() => setDicasOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label="Dicas"
            >
              <div className="tipsModal" onClick={(e) => e.stopPropagation()} role="document">
                <div className="tipsHeader">
                  <div className="tipsHeaderIcon"><Zap /></div>
                  <h3>Dicas para Melhor Resultado</h3>
                  <button
                      type="button"
                      className="tipsClose"
                      onClick={() => setDicasOpen(false)}
                      aria-label="Fechar dicas"
                  >
                    <X />
                  </button>
                </div>

                <div className="tipsContent">
                  <div className="tipsGrid">
                    <div className="tipItem">
                      <div className="tipIcon"><Target /></div>
                      <div className="tipText">
                        <strong>Iluminação Adequada</strong>
                        <span>Mantenha boa iluminação ao escanear o QR code.</span>
                      </div>
                    </div>

                    <div className="tipItem">
                      <div className="tipIcon"><Smartphone /></div>
                      <div className="tipText">
                        <strong>Foco da Câmera</strong>
                        <span>Certifique-se de que a câmera focou no código.</span>
                      </div>
                    </div>

                    <div className="tipItem">
                      <div className="tipIcon"><Camera /></div>
                      <div className="tipText">
                        <strong>Processamento</strong>
                        <span>Aguarde alguns segundos pelo processamento.</span>
                      </div>
                    </div>

                    <div className="tipItem">
                      <div className="tipIcon"><CheckCircle /></div>
                      <div className="tipText">
                        <strong>Revisão</strong>
                        <span>Sempre revise os resultados da correção automática.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}
