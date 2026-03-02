import * as Yup from 'yup';

export const loginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

export const signupSchema = Yup.object().shape({
  name: Yup.string().required('Full name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

export const eventFormSchema = Yup.object().shape({
  name: Yup.string().required('Event name is required'),
  description: Yup.string().required('Description is required'),
  venue: Yup.string().required('Venue is required'),
  startDate: Yup.string().required('Start date is required'),
  endDate: Yup.string()
    .nullable()
    .test('is-after-start', 'End date must be after start date', function (value) {
      const { startDate } = this.parent;
      return !value || !startDate || new Date(value) > new Date(startDate);
    }),
  category: Yup.string().required('Category is required'),
  status: Yup.string().oneOf(['upcoming', 'ongoing', 'completed', 'cancelled']),
});
