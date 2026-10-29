import { useState, useEffect } from 'react';
import {
  buscarQuestoesDaLista,
  criarQuestaoBackend,
  buscarMaisQuestoes,
  salvarDadosLista,
  baixarListaComQuestoes,
  baixarCorrecaoAtividadeDocx,
  baixarSolucoesAtividade,
  atualizarQuestao
} from '../services/Api.jsx';

export default function useEditorQuestoes(listaUuid) {
  const [questoesDisponiveis, setQuestoesDisponiveis] = useState([]);
  const [questoesSelecionadas, setQuestoesSelecionadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listaNome, setListaNome] = useState('');
  const [isSavingList, setIsSavingList] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!listaUuid) return;
    setLoading(true);
    buscarQuestoesDaLista(listaUuid)
      .then(data => {
        if (Array.isArray(data)) {
          setQuestoesDisponiveis(data);
          // Inicializa as questões selecionadas com as questões existentes
          setQuestoesSelecionadas(data.map(q => ({ ...q, peso: 1.0 })));
        } else {
          setQuestoesDisponiveis(data.questoes || []);
          // Inicializa as questões selecionadas com as questões existentes
          setQuestoesSelecionadas((data.questoes || []).map(q => ({ ...q, peso: 1.0 })));
          const nome = data.nome || data.nome_lista || data.nomeLista;
          if (nome) setListaNome(nome);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Erro ao carregar as questões.');
        setLoading(false);
      });
  }, [listaUuid]);

  const adicionarQuestao = (q) => {
    const questaoComPeso = { ...q, peso: 1.0 };
    setQuestoesSelecionadas(prev => [...prev, questaoComPeso]);
  };

  const removerQuestao = (id) => {
    setQuestoesSelecionadas(prev => prev.filter(q => q.uuid !== id));
  };

  const criarQuestao = async (dados) => {
    setIsLoading(true);
    try {
      const response = await criarQuestaoBackend(dados);
      setQuestoesDisponiveis(prev => [...prev, response]);
    } finally {
      setIsLoading(false);
    }
  };

  const salvarLista = async () => {
    if (!listaUuid) return;
    setIsSavingList(true);
    try {
      const questoesPayload = questoesSelecionadas.reduce((acc, q) => {
        acc[q.uuid] = q.peso ?? 1.0;
        return acc;
      }, {});
      await salvarDadosLista({ listaUuid, questoes: questoesPayload });
    } finally {
      setIsSavingList(false);
    }
  };


  const baixarPDF = async () => {
    if (!listaUuid) return;
    setIsDownloading(true);
    try {
      const dados = {
        lista_atividade_id: listaUuid,
        questoes: questoesSelecionadas.reduce((acc, q) => {
          acc[q.uuid] = q.peso ?? 1.0;
          return acc;
        }, {})
      };
      const response = await baixarListaComQuestoes(dados);
      const url = URL.createObjectURL(response.data || response);
      const link = document.createElement('a');
      link.href = url;
      const nomeArquivo = listaNome || `correcao_lista_${listaUuid}`;
      link.download = `${nomeArquivo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const respSol = await baixarSolucoesAtividade(dados);
      const urlSol = URL.createObjectURL(respSol.data || respSol);
      const linkSol = document.createElement('a');
      linkSol.href = urlSol;
      const nomeSolucao = listaNome ? `Resolução ${listaNome}` : `solucoes_lista_${listaUuid}`;
      linkSol.download = `${nomeSolucao}.pdf`;
      document.body.appendChild(linkSol);
      linkSol.click();
      linkSol.remove();
      URL.revokeObjectURL(urlSol);
    } finally {
      setIsDownloading(false);
    }
  };

  const baixarDOCX = async () => {
    if (!listaUuid) return;
    setIsDownloadingDocx(true);
    try {
      const dados = {
        lista_atividade_id: listaUuid,
        questoes: questoesSelecionadas.reduce((acc, q) => {
          acc[q.uuid] = q.peso ?? 1.0;
          return acc;
        }, {})
      };
      const response = await baixarCorrecaoAtividadeDocx(dados);
      const url = URL.createObjectURL(response.data || response);
      const link = document.createElement('a');
      link.href = url;
      const nomeArquivo = listaNome || `correcao_lista_${listaUuid}`;
      link.download = `${nomeArquivo}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const gerarMaisQuestoes = async () => {
    setIsGeneratingMore(true);
    try {
      const maisQuestoes = await buscarMaisQuestoes(listaUuid);
      setQuestoesDisponiveis(prev => [...prev, ...maisQuestoes]);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const salvarEdicao = async (id, dados) => {
    setIsLoading(true);
    try {
      await atualizarQuestao(id, dados);
      setQuestoesSelecionadas(prev => prev.map(q => q.uuid === id ? { ...q, ...dados, editada: true } : q));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    questoesDisponiveis,
    questoesSelecionadas,
    loading,
    error,
    isSavingList,
    isDownloading,
    isDownloadingDocx,
    isGeneratingMore,
    isLoading,
    adicionarQuestao,
    removerQuestao,
    criarQuestao,
    salvarLista,
    baixarPDF,
    baixarDOCX,
    gerarMaisQuestoes,
    salvarEdicao,
    setQuestoesDisponiveis,
    setQuestoesSelecionadas,
    listaNome
  };
}
