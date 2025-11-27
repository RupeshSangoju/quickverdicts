import { useReducer, useCallback, useEffect, useRef } from 'react';
import { SignupState, SignupAction, UserType, AttorneyFormData, JurorFormData } from '../types/signup.types';

const initialAttorneyData: AttorneyFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  lawFirmName: '',
  phoneNumber: '',
  state: '',
  stateCode: '',
  stateBarNumber: '',
  officeAddress1: '',
  officeAddress2: '',
  county: '',
  countyCode: '',
  city: '',
  cityCode: '',
  zipCode: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false, // ✅ FIXED: Changed from userAgreementAccepted
};

const initialJurorData: JurorFormData = {
  criteriaAnswers: {
    age: '',
    citizen: '',
    work1: '',
    work2: '',
    felony: '',
    indictment: '',
  },
  personalDetails1: {
    maritalStatus: '',
    spouseEmployer: '',
    employerName: '',
    employerAddress: '',
    yearsInCounty: '',
    ageRange: '',
    gender: '',
    education: '',
  },
  personalDetails2: {
    name: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    county: '',
  },
  paymentMethod: null,
  email: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
  stateCode: '',
  countyCode: '',
  cityCode: '',
};

function createInitialState(userType: UserType): SignupState {
  return {
    step: 1,
    personalSubStep: 1,
    authSubStep: 1,
    formData: userType === 'attorney' ? initialAttorneyData : initialJurorData,
    validationErrors: {},
    loading: false,
    error: null,
    hasScrolledToBottom: false,
  };
}

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    
    case 'SET_PERSONAL_SUB_STEP':
      return { ...state, personalSubStep: action.payload };
    
    case 'SET_AUTH_SUB_STEP':
      return { ...state, authSubStep: action.payload };
    
    case 'UPDATE_FORM_DATA':
      return {
        ...state,
        formData: { ...state.formData, ...action.payload },
      };
    
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };
    
    case 'CLEAR_FIELD_ERROR':
      const { [action.payload]: removedError, ...remainingErrors } = state.validationErrors;
      return { ...state, validationErrors: remainingErrors };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_SCROLLED_TO_BOTTOM':
      if (state.hasScrolledToBottom !== action.payload) {
        return { ...state, hasScrolledToBottom: action.payload };
      }
      return state;
    
    case 'RESET_FORM':
      return createInitialState('attorney');
    
    default:
      return state;
  }
}

export function useSignupForm(userType: UserType) {
  const [state, dispatch] = useReducer(signupReducer, createInitialState(userType));
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);

  // Load draft on mount - ONLY ONCE
  useEffect(() => {
    if (loadedRef.current) return;
    
    const draftKey = `${userType}SignupDraft`;
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored);
        // Restore ALL data including password during signup flow
        if (draft.formData) {
          dispatch({ type: 'UPDATE_FORM_DATA', payload: draft.formData });
        }
        if (draft.step) {
          dispatch({ type: 'SET_STEP', payload: draft.step });
        }
        if (draft.personalSubStep) {
          dispatch({ type: 'SET_PERSONAL_SUB_STEP', payload: draft.personalSubStep });
        }
        if (draft.authSubStep) {
          dispatch({ type: 'SET_AUTH_SUB_STEP', payload: draft.authSubStep });
        }
        if (typeof draft.hasScrolledToBottom === 'boolean') {
          dispatch({ type: 'SET_SCROLLED_TO_BOTTOM', payload: draft.hasScrolledToBottom });
        }
      }
    } catch (error) {
      console.warn('Failed to load form draft:', error);
    }
    
    loadedRef.current = true;
  }, [userType]);

  // Persist to localStorage - KEEP PASSWORD during signup flow
  useEffect(() => {
    if (!loadedRef.current) return;
    
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    
    persistTimeoutRef.current = setTimeout(() => {
      const draftKey = `${userType}SignupDraft`;
      try {
        const draftData = {
          step: state.step,
          personalSubStep: state.personalSubStep,
          authSubStep: state.authSubStep,
          formData: state.formData, // Keep ALL data including password during signup
          hasScrolledToBottom: state.hasScrolledToBottom
        };
        
        localStorage.setItem(draftKey, JSON.stringify(draftData));
      } catch (error) {
        console.warn('Failed to persist form data:', error);
      }
    }, 200); // Faster persist for better UX

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [state, userType]);

  const actions = {
    setStep: useCallback((step: SignupState['step']) => {
      dispatch({ type: 'SET_STEP', payload: step });
    }, []),

    setPersonalSubStep: useCallback((subStep: SignupState['personalSubStep']) => {
      dispatch({ type: 'SET_PERSONAL_SUB_STEP', payload: subStep });
    }, []),

    setAuthSubStep: useCallback((subStep: SignupState['authSubStep']) => {
      dispatch({ type: 'SET_AUTH_SUB_STEP', payload: subStep });
    }, []),

    updateFormData: useCallback((data: Partial<AttorneyFormData | JurorFormData>) => {
      dispatch({ type: 'UPDATE_FORM_DATA', payload: data });
    }, []),

    setValidationErrors: useCallback((errors: Record<string, string>) => {
      dispatch({ type: 'SET_VALIDATION_ERRORS', payload: errors });
    }, []),

    clearFieldError: useCallback((fieldName: string) => {
      dispatch({ type: 'CLEAR_FIELD_ERROR', payload: fieldName });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    setScrolledToBottom: useCallback((scrolled: boolean) => {
      dispatch({ type: 'SET_SCROLLED_TO_BOTTOM', payload: scrolled });
    }, []),

    resetForm: useCallback(() => {
      dispatch({ type: 'RESET_FORM' });
    }, []),

    // ✅ Clear sensitive data after successful signup
    clearSensitiveData: useCallback(() => {
      dispatch({
        type: 'UPDATE_FORM_DATA',
        payload: {
          password: '',
          confirmPassword: '',
          otp: '', // This works because otp is optional in JurorFormData
        } as Partial<JurorFormData>, // Type assertion to handle optional otp
      });
    }, []),
  };

  return { state, actions };
}
