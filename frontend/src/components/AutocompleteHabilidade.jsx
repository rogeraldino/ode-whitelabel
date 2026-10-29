// AutocompleteHabilidade.jsx
import React from 'react';
import Select from 'react-select';


export default function AutocompleteHabilidade({ id, value, onChange, options, getOptionLabel, getOptionValue, onFocus, onMenuOpen, showNoDataMessage = false }) {
    // Garante que cada item selecionado contenha TODOS os campos
    const handleChange = (selected) => {
        if (!selected) {
            onChange([]);
            return;
        }
        const limited = selected.slice(0, 2); // Limita a duas opções
        const enriched = limited.map((item) => {
            // se já possui codigo_bncc, o objeto está completo
            if (item.codigo_bncc) return item;

            // caso contrário (opção criada manualmente), tente casar pelo value
            const match = options.find((opt) => opt.value === item.value);
            // se achar, junta os campos extras; senão devolve o que tem
            return match ? { ...match } : item;
        });
        onChange(enriched);
    };


    return (
        <div className="form-group rs-multi" id={id}>
            <Select
                isMulti
                options={options}
                value={value}
                onChange={handleChange}
                placeholder="Digite ou selecione..."
                className={`react-select ${value && value.length > 1 ? 'has-multiple-values' : ''}`}
                classNamePrefix="react-select"
                getOptionLabel={getOptionLabel}
                getOptionValue={getOptionValue}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                isOptionDisabled={() => value.length >= 2}
                onFocus={onFocus}
                onMenuOpen={onMenuOpen}
                noOptionsMessage={() => showNoDataMessage 
                    ? 'Nenhuma habilidade encontrada. Em breve haverá dados da BNCC disponíveis para esta etapa. Nossa equipe está trabalhando nisso!'
                    : 'Selecione primeiro o Componente curricular e Ano/Turma para ver as habilidades disponíveis.'
                }
            />
        </div>
    );
}
 
