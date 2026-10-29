import { useEffect, useRef } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PDFThumbnail({ url, width = 80, height = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let canceled = false;

    const render = async () => {
      try {
        const loadingTask = getDocument({ url, withCredentials: false });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      } catch (err) {
        console.error('Erro ao gerar miniatura do PDF:', err);
      }
    };

    if (url && !canceled) {
      render();
    }

    return () => {
      canceled = true;
    };
  }, [url, width, height]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}
