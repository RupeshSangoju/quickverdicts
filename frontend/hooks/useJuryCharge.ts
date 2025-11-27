import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

interface JuryChargeQuestion {
  QuestionId: number;
  CaseId: number;
  QuestionText: string;
  QuestionType: 'Multiple Choice' | 'Yes/No' | 'Text Response' | 'Numeric Response';
  Options: string;
  OrderIndex: number;
  IsRequired: boolean;
  MinValue?: number;
  MaxValue?: number;
}

interface UseJuryChargeReturn {
  questions: JuryChargeQuestion[];
  isLocked: boolean;
  loading: boolean;
  error: string | null;
  loadQuestions: () => Promise<void>;
  checkLockStatus: () => Promise<void>;
}

export function useJuryCharge(caseId: number): UseJuryChargeReturn {
  const { socket, isConnected, joinRoom, on, off } = useWebSocket();
  const [questions, setQuestions] = useState<JuryChargeQuestion[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jury-charge/questions/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Error loading questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const checkLockStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jury-charge/status/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsLocked(data.isLocked || false);
      }
    } catch (err) {
      console.error('Error checking lock status:', err);
    }
  }, [caseId]);

  useEffect(() => {
    loadQuestions();
    checkLockStatus();
  }, [loadQuestions, checkLockStatus]);

  useEffect(() => {
    if (!isConnected || !socket) return;

    // Join jury charge builder room
    joinRoom(`jury_charge_builder_${caseId}`);
    joinRoom(`case_${caseId}`);

    // Listen for question updates
    const handleQuestionAdded = (data: any) => {
      if (data.caseId === caseId) {
        console.log('📝 Question added:', data.question);
        loadQuestions();
      }
    };

    const handleQuestionUpdated = (data: any) => {
      if (data.caseId === caseId) {
        console.log('📝 Question updated:', data.question);
        loadQuestions();
      }
    };

    const handleQuestionDeleted = (data: any) => {
      if (data.caseId === caseId) {
        console.log('📝 Question deleted:', data.questionId);
        loadQuestions();
      }
    };

    const handleQuestionsReordered = (data: any) => {
      if (data.caseId === caseId) {
        console.log('📝 Questions reordered');
        loadQuestions();
      }
    };

    const handleJuryChargeReleased = (data: any) => {
      if (data.caseId === caseId) {
        console.log('🔒 Jury charge released and locked');
        setIsLocked(true);
        alert('The jury charge has been released to jurors and is now locked. You can no longer edit questions.');
      }
    };

    const handleJuryChargeLocked = (data: any) => {
      if (data.caseId === caseId) {
        console.log('🔒 Jury charge locked');
        setIsLocked(true);
      }
    };

    on('jury_charge:question_added', handleQuestionAdded);
    on('jury_charge:question_updated', handleQuestionUpdated);
    on('jury_charge:question_deleted', handleQuestionDeleted);
    on('jury_charge:questions_reordered', handleQuestionsReordered);
    on('jury_charge:released', handleJuryChargeReleased);
    on('jury_charge:locked', handleJuryChargeLocked);

    return () => {
      off('jury_charge:question_added', handleQuestionAdded);
      off('jury_charge:question_updated', handleQuestionUpdated);
      off('jury_charge:question_deleted', handleQuestionDeleted);
      off('jury_charge:questions_reordered', handleQuestionsReordered);
      off('jury_charge:released', handleJuryChargeReleased);
      off('jury_charge:locked', handleJuryChargeLocked);
    };
  }, [isConnected, socket, caseId, joinRoom, on, off, loadQuestions]);

  return {
    questions,
    isLocked,
    loading,
    error,
    loadQuestions,
    checkLockStatus,
  };
}
