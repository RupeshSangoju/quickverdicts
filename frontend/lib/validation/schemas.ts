import { z } from 'zod';

// Common validation patterns
const emailSchema = z.string().email('Please enter a valid email address');
const phoneSchema = z.string().regex(
  /^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/,
  'Please enter a valid phone number'
);
const zipCodeSchema = z.string().regex(
  /^\d{5}(-\d{4})?$/,
  'Please enter a valid ZIP code'
);

// Password validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[A-Z]/, 'Password must contain at least one capital letter')
  .regex(/[!@#$%^&*()[\]{};:'",.<>/?\\|`~_\-+=]/, 'Password must contain at least one special character')
  .regex(/^(?!.*(.)\1{2,})/, 'Password must not contain more than 2 consecutive identical characters');

// Attorney Schemas
export const attorneyStep1Schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  lawFirmName: z.string().min(1, 'Law firm entity name is required'),
  phoneNumber: phoneSchema,
  state: z.string().min(1, 'State is required'),
  stateBarNumber: z.string().min(1, 'State bar number is required'),
});

export const attorneyStep2Schema = z.object({
  officeAddress1: z.string().min(1, 'Office address 1 is required'),
  county: z.string().min(1, 'County is required'),
  city: z.string().min(1, 'City is required'),
  zipCode: zipCodeSchema,
});

export const attorneyStep3Schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const attorneyStep4Schema = z.object({
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms to create an account'),
});

// Juror Schemas
export const jurorStep1Schema = z.object({
  criteriaAnswers: z.object({
    age: z.enum(['yes', 'no'], 'This question is required'),
    citizen: z.enum(['yes', 'no'], 'This question is required'),
    work1: z.enum(['yes', 'no'], 'This question is required'),
    work2: z.enum(['yes', 'no'], 'This question is required'),
    felony: z.enum(['yes', 'no'], 'This question is required'),
    indictment: z.enum(['yes', 'no'], 'This question is required'),
  })
}).refine(data => {
  const { age, citizen, indictment } = data.criteriaAnswers;
  return age === 'yes' && citizen === 'yes' && indictment === 'no';
}, {
  message: 'You do not meet the eligibility requirements for jury service',
  path: ['criteriaAnswers', 'eligibility'],
});


export const jurorStep2SubStep2Schema = z.object({
  personalDetails2: z.object({
    name: z.string().min(1, 'Name is required'),
    phone: phoneSchema,
    address1: z.string().min(1, 'Address is required'),
    state: z.string().min(1, 'State is required'),
    county: z.string().min(1, 'County is required'),
    city: z.string().min(1, 'City is required'),
    zip: zipCodeSchema,
  }),
  paymentMethod: z.enum(['venmo', 'paypal', 'cashapp','zelle'], 'Please select a payment method'),
});


export const jurorStep3Schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const jurorStep4Schema = z.object({
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the user agreement'),
});