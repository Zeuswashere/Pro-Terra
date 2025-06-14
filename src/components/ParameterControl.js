import React from 'react';
import PropTypes from 'prop-types';

const accent = '#6ec1e4';
const border = '#333a';
const bg = 'rgba(35,36,58,0.85)';
const labelColor = '#e3e3e3';
const descColor = '#aab';
const focusShadow = `0 0 0 2px ${accent}55`;

const ParameterControl = ({ 
  label, 
  type, 
  value, 
  onChange, 
  options = [], 
  min = undefined, 
  max = undefined, 
  step = undefined, 
  description = undefined 
}) => {
  const [sliderHover, setSliderHover] = React.useState(false);
  const [sliderFocus, setSliderFocus] = React.useState(false);
  const showBubble = sliderHover || sliderFocus;
  
  return (
    <div style={{
      marginBottom: 18,
      background: bg,
      borderRadius: 10,
      boxShadow: '0 1px 6px 0 rgba(0,0,0,0.10)',
      border: `1.5px solid ${border}`,
      padding: '14px 16px',
      transition: 'box-shadow 0.2s, border 0.2s',
      position: 'relative',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      <label style={{
        fontWeight: 600,
        color: labelColor,
        fontSize: 15,
        marginBottom: 2,
        letterSpacing: 0.1,
        cursor: type === 'checkbox' ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        {label}
        {description && <span style={{ color: descColor, fontWeight: 400, fontSize: 13, marginLeft: 6 }}>{description}</span>}
      </label>
        {type === 'range' && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, position: 'relative', minHeight: 44 }}>
          <div style={{ flex: 1, position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
            <input 
              type="range" 
              min={min} 
              max={max} 
              step={step} 
              value={value} 
              aria-label={label}
              onChange={e => { e.preventDefault(); onChange(e.target.value); }} 
              style={{
                width: '100%',
                height: 8,
                borderRadius: 6,
                background: `linear-gradient(90deg, ${accent} ${(value-min)/(max-min)*100}%, #23243a ${(value-min)/(max-min)*100}%)`,
                outline: 'none',
                boxShadow: sliderFocus ? focusShadow : undefined,
                appearance: 'none',
                transition: 'background 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setSliderHover(true)}
              onMouseLeave={() => setSliderHover(false)}
              onFocus={() => setSliderFocus(true)}
              onBlur={() => setSliderFocus(false)}
            />
            {/* Custom thumb using ::-webkit-slider-thumb and ::-moz-range-thumb via style tag */}
            <style>{`
              input[type=range]::-webkit-slider-thumb {
                appearance: none;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: ${accent};
                box-shadow: 0 2px 8px 0 ${accent}44;
                border: 2.5px solid #fff;
                transition: transform 0.18s, box-shadow 0.18s;
                transform: scale(${showBubble ? 1.18 : 1});
              }
              input[type=range]:focus::-webkit-slider-thumb {
                box-shadow: 0 0 0 4px ${accent}55;
              }
              input[type=range]::-moz-range-thumb {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: ${accent};
                box-shadow: 0 2px 8px 0 ${accent}44;
                border: 2.5px solid #fff;
                transition: transform 0.18s, box-shadow 0.18s;
                transform: scale(${showBubble ? 1.18 : 1});
              }
              input[type=range]:focus::-moz-range-thumb {
                box-shadow: 0 0 0 4px ${accent}55;
              }
              input[type=range]::-ms-thumb {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: ${accent};
                box-shadow: 0 2px 8px 0 ${accent}44;
                border: 2.5px solid #fff;
                transition: transform 0.18s, box-shadow 0.18s;
                transform: scale(${showBubble ? 1.18 : 1});
              }
            `}</style>
            {/* Value bubble */}
            <span
              style={{
                position: 'absolute',
                left: `calc(${((value - min) / (max - min)) * 100}% - 18px)`,
                top: -32,
                background: accent,
                color: '#23243a',
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 8,
                padding: '3px 12px',
                opacity: showBubble ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 0.2s, left 0.2s',
                zIndex: 2,
                boxShadow: '0 2px 8px 0 rgba(110,193,228,0.18)'
              }}
              aria-hidden={!showBubble}
            >
              {value}
            </span>
          </div>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
            aria-label={label + ' value'}
              onChange={e => { e.preventDefault(); onChange(e.target.value); }}
            style={{
              width: 60,
              marginLeft: 12,
              padding: '6px 10px',
              border: `1.5px solid ${border}`,
              borderRadius: 8,
              background: 'rgba(30,32,48,0.95)',
              color: labelColor,
              fontWeight: 500,
              fontSize: 16,
              outline: 'none',
              boxShadow: sliderFocus ? focusShadow : undefined,
              transition: 'box-shadow 0.2s',
            }}
            />
          </div>
        )}
      {type === 'number' && (
        <input 
          type="number" 
          min={min} 
          max={max} 
          step={step}
          value={value} 
          onChange={e => { e.preventDefault(); onChange(e.target.value); }} 
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(30,32,48,0.95)',
            border: `1.5px solid ${border}`,
            borderRadius: 7,
            color: labelColor,
            fontWeight: 500,
            fontSize: 15,
            outline: 'none',
            boxShadow: 'none',
            transition: 'box-shadow 0.2s',
          }}
        />
      )}
      {type === 'checkbox' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 2 }}>
        <input 
          type="checkbox" 
          checked={value} 
          onChange={e => { e.preventDefault(); onChange(e.target.checked); }} 
            style={{
              width: 20,
              height: 20,
              accentColor: accent,
              borderRadius: 6,
              border: `1.5px solid ${border}`,
              boxShadow: 'none',
              marginRight: 6,
              cursor: 'pointer',
              outline: 'none',
              transition: 'box-shadow 0.2s',
            }}
        />
        </label>
      )}
      {type === 'select' && (
        <select 
          value={value} 
          onChange={e => { e.preventDefault(); onChange(e.target.value); }} 
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(30,32,48,0.95)',
            border: `1.5px solid ${border}`,
            borderRadius: 7,
            color: labelColor,
            fontWeight: 500,
            fontSize: 15,
            outline: 'none',
            boxShadow: 'none',
            marginTop: 2,
            cursor: 'pointer',
            transition: 'box-shadow 0.2s',
          }}
        >
          {options.map(option => (
            <option key={option.value} value={option.value} style={{ color: '#23243a', background: '#fff' }}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {type === 'color' && (
        <input 
          type="color" 
          value={value} 
          onChange={e => { e.preventDefault(); onChange(e.target.value); }} 
          style={{
            width: 40,
            height: 32,
            border: `1.5px solid ${border}`,
            borderRadius: 7,
            background: 'none',
            marginTop: 2,
            cursor: 'pointer',
            outline: 'none',
            boxShadow: 'none',
            transition: 'box-shadow 0.2s',
          }}
        />
      )}
      {type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={e => { e.preventDefault(); onChange(e.target.value); }}
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(30,32,48,0.95)',
            border: `1.5px solid ${border}`,
            borderRadius: 7,
            color: labelColor,
            fontWeight: 500,
            fontSize: 15,
            outline: 'none',
            boxShadow: 'none',
            marginTop: 2,
            transition: 'box-shadow 0.2s',
          }}
        />
      )}
    </div>
  );
};

ParameterControl.propTypes = {
  label: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['range', 'number', 'checkbox', 'select', 'color', 'text']).isRequired,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.bool
  ]).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  description: PropTypes.string
};

export default ParameterControl; 