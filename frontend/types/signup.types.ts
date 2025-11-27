export type UserType = 'attorney' | 'juror';

export type SignupStep = 1 | 2 | 3 | 4 | 5;

export interface ValidationErrors {
  [key: string]: string;
}

export interface LocationOption {
  label: string;
  value: string;
}

// types/signup.types.ts

export interface AttorneyFormData {
  // Step 1: Personal Details
  firstName: string;
  middleName?: string;
  lastName: string;
  lawFirmName: string;
  stateBarNumber: string;
  phoneNumber: string;

  // Step 2: Address Details
  state: string;
  stateCode?: string;
  county: string;
  countyCode?: string;
  city: string;
  cityCode?: string; 
  officeAddress1: string;
  officeAddress2?: string;
  zipCode: string;

  // Step 3: Email & Password
  email: string;
  password: string;
  confirmPassword?: string;
  otp?: string;
  emailVerified?: boolean;

  // Step 4: Agreement
  agreedToTerms: boolean;

  // Metadata
  attorneyId?: string;
}

// ============================================
// JUROR TYPES
// ============================================

export interface CriteriaAnswers {
  age: string;
  citizen: string;
  work1: string;
  work2: string;
  felony: string;
  indictment: string;
}

export interface PersonalDetails1 {
  maritalStatus: string;
  spouseEmployer: string;
  employerName: string;
  employerAddress: string;
  yearsInCounty: string;
  ageRange: string;
  gender: string;
  education: string;
}

export interface PersonalDetails2 {
  name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

export interface JurorFormData {
  criteriaAnswers: CriteriaAnswers;
  personalDetails1: PersonalDetails1;
  personalDetails2: PersonalDetails2;
  paymentMethod: 'venmo' | 'paypal' | 'cashapp' | 'zelle' | null;
  email: string;
  password: string;
  confirmPassword: string;
  emailVerified?: boolean;
  agreedToTerms: boolean;
  stateCode: string;
  countyCode: string;
  cityCode: string;
  jurorId?: string;
  
  otp?: string; // ✅ Added: fixes "Property 'otp' does not exist" error
}

// ============================================
// COMMON SIGNUP STATE & ACTIONS
// ============================================

export interface SignupState {
  step: SignupStep;
  personalSubStep: 1 | 2;
  authSubStep: 1 | 2;
  formData: AttorneyFormData | JurorFormData;
  validationErrors: ValidationErrors;
  loading: boolean;
  error: string | null;
  hasScrolledToBottom: boolean;
}

export type SignupAction =
  | { type: 'SET_STEP'; payload: SignupStep }
  | { type: 'SET_PERSONAL_SUB_STEP'; payload: 1 | 2 }
  | { type: 'SET_AUTH_SUB_STEP'; payload: 1 | 2 }
  | { type: 'UPDATE_FORM_DATA'; payload: Partial<AttorneyFormData | JurorFormData> }
  | { type: 'SET_VALIDATION_ERRORS'; payload: ValidationErrors }
  | { type: 'CLEAR_FIELD_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SCROLLED_TO_BOTTOM'; payload: boolean }
  | { type: 'RESET_FORM' };
