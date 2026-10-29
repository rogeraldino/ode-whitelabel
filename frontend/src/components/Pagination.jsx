import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  pageSize, 
  onPageSizeChange, 
  totalItems,
  pageSizeOptions = [5, 10, 15, 20, 25, 50],
  showPageSizeSelector = true,
  showTotal = true,
  loading = false,
  className = ''
}) => {
  const isMobile = window.innerWidth <= 768;

  // Para mobile, mostrar apenas navegação básica
  if (isMobile) {
    return (
      <div className={`pagination pagination--mobile ${className}`}>
        {/* Controles de navegação simplificados para mobile */}
        <div className="pagination__controls">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || loading}
            className="pagination__btn pagination__btn--nav"
            title="Primeira página"
          >
            <ChevronsLeft size={16} />
          </button>

          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="pagination__btn pagination__btn--nav"
            title="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Indicador de página atual */}
          <div className="pagination__current">
            {currentPage} de {totalPages}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="pagination__btn pagination__btn--nav"
            title="Próxima página"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || loading}
            className="pagination__btn pagination__btn--nav"
            title="Última página"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Informações adicionais para mobile */}
        {showTotal && (
          <div className="pagination__info">
            <span>Total: {totalItems} itens</span>
          </div>
        )}
      </div>
    );
  }

  // Para desktop, mostrar controles completos
  return (
    <div className={`pagination pagination--desktop ${className}`}>
      {/* Seletor de quantidade por página */}
      {showPageSizeSelector && (
        <div className="pagination__page-size">
          <span>Quantidade por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
            className="pagination__select"
            disabled={loading}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}

      {/* Controles de navegação */}
      <div className="pagination__controls">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1 || loading}
          className="pagination__btn pagination__btn--nav"
          title="Primeira página"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className="pagination__btn pagination__btn--nav"
          title="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Indicador de página atual */}
        <div className="pagination__current">
          {currentPage} de {totalPages}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          className="pagination__btn pagination__btn--nav"
          title="Próxima página"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages || loading}
          className="pagination__btn pagination__btn--nav"
          title="Última página"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {/* Informação do total */}
      {showTotal && (
        <div className="pagination__total">
          Total: <strong>{totalItems}</strong> itens
        </div>
      )}
    </div>
  );
};

export default Pagination;
