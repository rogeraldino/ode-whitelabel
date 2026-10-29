import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Lightbulb, Target, Users, Clock, Sparkles, FileText, Plus, AlertTriangle } from 'lucide-react';
import ParticleAnimation from './ParticleAnimation';
import ProgressBar from './ProgressBar';
import '../style/LoadingScreen.css';

const LoadingScreen = ({ 
  isVisible, 
  onComplete, 
  title = "Gerando plano de aula",
  subtitle = "Aguarde enquanto criamos seu documento personalizado...",
  primaryColor = "#7C3AED",
  steps = null,
  icon: CustomIcon = BookOpen,
  currentStepIndex = null,
  autoProgress = true,
  minTotalDuration = null,
  estimatedDuration = null,
  adaptiveMode = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highestStepReached, setHighestStepReached] = useState(0);
  const progressRef = useRef(0);
  const startTimeRef = useRef(null);
  const [actualDuration, setActualDuration] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [adaptiveStepDuration, setAdaptiveStepDuration] = useState(0);
  const portalRef = useRef(typeof document !== 'undefined' ? document.createElement('div') : null);

  useEffect(() => {
    if (!portalRef.current || typeof document === 'undefined') {
      return undefined;
    }

    const { current: portalNode } = portalRef;
    portalNode.className = 'loading-screen__portal-root';
    document.body.appendChild(portalNode);

    return () => {
      document.body.removeChild(portalNode);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    if (!isVisible) {
      return undefined;
    }

    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousTouchAction = style.touchAction;

    style.overflow = 'hidden';
    style.touchAction = 'none';

    return () => {
      style.overflow = previousOverflow;
      style.touchAction = previousTouchAction;
    };
  }, [isVisible]);

  // Mapeamento de ícones por nome
  const iconMap = {
    'BookOpen': BookOpen,
    'Lightbulb': Lightbulb,
    'Target': Target,
    'Users': Users,
    'Clock': Clock,
    'Sparkles': Sparkles,
    'FileText': FileText,
    'Plus': Plus,
    'AlertTriangle': AlertTriangle
  };

  const getIconComponent = (iconName) => {
    if (typeof iconName === 'string') {
      return iconMap[iconName] || BookOpen;
    }
    return iconName;
  };

  const defaultSteps = [
    {
      id: 0,
      title: 'Analisando parâmetros',
      description: 'Processando informações do plano de aula...',
      icon: BookOpen
    },
    {
      id: 1,
      title: 'Definindo objetivos',
      description: 'Criando objetivos de aprendizagem...',
      icon: Target
    },
    {
      id: 2,
      title: 'Planejando atividades',
      description: 'Desenvolvendo atividades interativas...',
      icon: Lightbulb
    },
    {
      id: 3,
      title: 'Organizando recursos',
      description: 'Preparando materiais e recursos...',
      icon: Users
    }
  ];

  const finalSteps = (Array.isArray(steps) && steps.length > 0)
      ? steps
      : defaultSteps;

  // Função para atualizar o step garantindo progresso constante
  const updateStep = (newStep, progress = 0) => {
    const clampedStep = Math.min(newStep, Math.max(0, finalSteps.length - 1));
    const maxStep = Math.max(highestStepReached, clampedStep);
    
    setHighestStepReached(maxStep);
    setCurrentStep(maxStep);
    setStepProgress(progress);
    progressRef.current = maxStep;
  };

  // Sistema inteligente de distribuição de tempo - MUITO MAIS RÁPIDO
  const calculateAdaptiveTiming = () => {
    if (!startTimeRef.current) return { stepDuration: 500, totalDuration: 2500 };
    
    const elapsedTime = Date.now() - startTimeRef.current;
    const remainingSteps = finalSteps.length - currentStep;
    
    // Se ainda há muito tempo estimado, distribui de forma MUITO RÁPIDA
    if (estimatedDuration && elapsedTime < estimatedDuration * 0.6) {
      const remainingTime = estimatedDuration - elapsedTime;
      const stepDuration = remainingTime / remainingSteps;
      return { stepDuration, totalDuration: estimatedDuration };
    }
    
    // Se está demorando mais que o esperado, acelera MUITO
    const accelerationFactor = Math.min(3, 1 + (elapsedTime / (estimatedDuration || 20000)));
    const baseStepDuration = 400 / accelerationFactor;
    const stepDuration = Math.max(150, baseStepDuration);
    
    return { stepDuration, totalDuration: elapsedTime + (remainingSteps * stepDuration) };
  };

  // Se currentStepIndex for fornecido externamente, use-o
  useEffect(() => {
    if (currentStepIndex !== null && currentStepIndex !== undefined) {
      updateStep(currentStepIndex);
    }
  }, [currentStepIndex]);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setHighestStepReached(0);
      setStepProgress(0);
      progressRef.current = 0;
      startTimeRef.current = null;
      setActualDuration(0);
      setAdaptiveStepDuration(0);
      return;
    }

    // Registrar tempo de início
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    if (!autoProgress) return;

    // Modo adaptativo inteligente - MUITO MAIS RÁPIDO
    if (adaptiveMode) {
      const interval = setInterval(() => {
        const { stepDuration, totalDuration } = calculateAdaptiveTiming();
        setAdaptiveStepDuration(stepDuration);
        
        const elapsedTime = Date.now() - startTimeRef.current;
        const currentStepTime = elapsedTime - (currentStep * stepDuration);
        const stepProgress = Math.min(1, currentStepTime / stepDuration);
        
        // Atualiza progresso dentro da etapa atual
        setStepProgress(stepProgress);
        
        // Calcula próxima etapa baseada no tempo - MUITO MAIS RÁPIDO
        const newStep = Math.floor(elapsedTime / stepDuration);
        
        if (newStep > progressRef.current && newStep < finalSteps.length) {
          updateStep(newStep, 0);
        }
        
        // Se chegou ao final ou ultrapassou o tempo estimado
        if (newStep >= finalSteps.length - 1 || elapsedTime >= totalDuration) {
          clearInterval(interval);
          updateStep(finalSteps.length - 1, 1);
          
          // Delay MÍNIMO para mostrar a última etapa
          setTimeout(() => {
            onComplete && onComplete();
          }, 100);
        }
      }, 8); // 120+ FPS para MÁXIMA fluidez

      return () => clearInterval(interval);
    }

    // Modo inteligente com tempo estimado - MUITO MAIS RÁPIDO
    if (estimatedDuration) {
      const stepDuration = estimatedDuration / finalSteps.length;
      let currentTime = 0;
      
      const interval = setInterval(() => {
        currentTime += 8; // 120+ FPS
        const newStep = Math.floor(currentTime / stepDuration);
        const stepProgress = (currentTime % stepDuration) / stepDuration;
        
        if (newStep > progressRef.current) {
          updateStep(newStep, stepProgress);
        } else if (newStep === progressRef.current) {
          setStepProgress(stepProgress);
        }

        if (currentTime >= estimatedDuration) {
          clearInterval(interval);
          updateStep(finalSteps.length - 1, 1);
          setTimeout(() => {
            onComplete && onComplete();
          }, 100);
        }
      }, 8);

      return () => clearInterval(interval);
    }

    // Modo com duração mínima - MUITO MAIS RÁPIDO
    if (minTotalDuration) {
      const stepDuration = minTotalDuration / finalSteps.length;
      let currentTime = 0;
      
      const interval = setInterval(() => {
        currentTime += 8;
        const newStep = Math.floor(currentTime / stepDuration);
        const stepProgress = (currentTime % stepDuration) / stepDuration;
        
        if (newStep > progressRef.current) {
          updateStep(newStep, stepProgress);
        } else if (newStep === progressRef.current) {
          setStepProgress(stepProgress);
        }

        if (currentTime >= minTotalDuration) {
          clearInterval(interval);
          updateStep(finalSteps.length - 1, 1);
          setTimeout(() => {
            onComplete && onComplete();
          }, 100);
        }
      }, 8);

      return () => clearInterval(interval);
    }

    // Modo automático padrão otimizado - MUITO MAIS RÁPIDO
    const stepDuration = 200; // MUITO RÁPIDO: 200ms por etapa
    let currentTime = 0;
    const totalDuration = stepDuration * finalSteps.length;
    
    const interval = setInterval(() => {
      currentTime += 8;
      const newStep = Math.floor(currentTime / stepDuration);
      const stepProgress = (currentTime % stepDuration) / stepDuration;
      
      if (newStep > progressRef.current) {
        updateStep(newStep, stepProgress);
      } else if (newStep === progressRef.current) {
        setStepProgress(stepProgress);
      }

      if (currentTime >= totalDuration) {
        clearInterval(interval);
        updateStep(finalSteps.length - 1, 1);
        setTimeout(() => {
          onComplete && onComplete();
        }, 100);
      }
    }, 8);

    return () => clearInterval(interval);
  }, [isVisible, onComplete, finalSteps, autoProgress, minTotalDuration, estimatedDuration, currentStepIndex, adaptiveMode, currentStep]);

  // Monitorar tempo real quando o loading terminar
  useEffect(() => {
    if (!isVisible && startTimeRef.current) {
      const endTime = Date.now();
      const duration = endTime - startTimeRef.current;
      setActualDuration(duration);
      console.log(`⏱️ Tempo real de processamento: ${Math.round(duration / 1000)}s`);
      console.log(`📊 Etapas completadas: ${finalSteps.length}`);
      console.log(`⚡ Tempo médio por etapa: ${Math.round(duration / finalSteps.length)}ms`);
    }
  }, [isVisible, finalSteps.length]);

  if (!isVisible || !portalRef.current) return null;

  const safeIndex = Math.min(currentStep, Math.max(0, finalSteps.length - 1));
  const step = finalSteps[safeIndex];
  const IconComponent = getIconComponent(step.icon);
  const HeaderIcon = getIconComponent(CustomIcon);
  const overlayContent = (
    <div className="loading-screen__overlay" role="alert" aria-live="assertive">
      <ParticleAnimation isActive={isVisible} />
      <div
        className="loading-container"
        style={{
          '--primary-color': primaryColor,
          '--primary-color-shadow': `${primaryColor}40`
        }}
      >
        <div className="loading-header">
          <div
            className="loading-icon"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}25 100%)`,
              boxShadow: `0 4px 12px ${primaryColor}25`
            }}
          >
            <HeaderIcon size={32} color={primaryColor} />
          </div>
          <h2 className="loading-title">{title}</h2>
          <p className="loading-subtitle">{subtitle}</p>
        </div>

        <ProgressBar
          currentStep={currentStep}
          totalSteps={finalSteps.length}
          primaryColor={primaryColor}
          stepProgress={stepProgress}
        />

        <div className="loading-step-message">
          <div
            className="step-message-icon"
            style={{
              background: `${primaryColor}15`,
              boxShadow: `0 2px 8px ${primaryColor}20`
            }}
          >
            <IconComponent size={24} color={primaryColor} />
          </div>
          <div className="step-message-text">
            <strong style={{ color: primaryColor }}>{step.title}</strong>
            <div>{step.description}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, portalRef.current);
};

export default LoadingScreen; 
