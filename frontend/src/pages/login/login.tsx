import { useState } from 'react';
import {
  Form,
  TextInput,
  Button,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import './login.scss';
import { FetchMe, SignIn } from '../../redux/features/slices/authSlice.ts';
import { useAppDispatch } from '../../redux/store.ts';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const dispatch = useAppDispatch();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!userName || !password) {
      setError('Username and password are required.');
      setLoading(false);
      return;
    }

    const payload = { username: userName, password: password };
    try {
      await dispatch(SignIn(payload)).unwrap();
      await dispatch(FetchMe());
      navigate('/dashboard');
    } catch (error: any) {
      console.log(error)
      setError(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className='login-container'>
      <div className='login-background'>
        <div className='login-background__shape login-background__shape--1'></div>
        <div className='login-background__shape login-background__shape--2'></div>
        <div className='login-background__shape login-background__shape--3'></div>
      </div>

      <div className='login-content'>
        <div className='login-card'>
          <div className='login-header'>
            <div className='login-header__icon-group'>
              <svg
                className='login-header__icon'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M9 7H15'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                />
                <path
                  d='M9 12H15'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                />
                <path
                  d='M9 17H13'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                />
              </svg>
              <svg
                className='login-header__icon'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M16 7V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V7'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M12 12V17'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                />
                <circle cx='12' cy='14.5' r='0.5' fill='currentColor' />
              </svg>
              <svg
                className='login-header__icon'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M17.657 18.657A8 8 0 0 1 6.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0 1 20 13a7.975 7.975 0 0 1-2.343 5.657z'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M9.879 16.121A3 3 0 1 0 12.015 11L11 14H9c0 .768.293 1.536.879 2.121z'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
            <h1 className='login-header__title'>Welcome Back</h1>
            <p className='login-header__subtitle'>
              Sign in to access your healthcare management system
            </p>
          </div>

          <Form onSubmit={handleSubmit} className='login-form'>
            {error && (
              <div className='login-form__notification'>
                <InlineNotification
                  kind='error'
                  title='Login failed'
                  subtitle={error}
                  hideCloseButton
                />
              </div>
            )}

            <div className='login-form__field'>
              <TextInput
                id='username'
                labelText='Username'
                type='text'
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
            </div>

            <div className='login-form__field'>
              <TextInput
                id='password'
                labelText='Password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className='login-form__actions'>
              <Button
                type='submit'
                disabled={loading}
                className='login-form__button'
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>

              {loading && (
                <div className='login-form__loading'>
                  <InlineLoading description='Authenticating...' />
                </div>
              )}
            </div>
          </Form>

          <div className='login-footer'>
            <div className='login-footer__divider'></div>
            <div className='login-footer__features'>
              <div className='login-footer__feature'>
                <svg
                  viewBox='0 0 20 20'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M3 8h14M3 12h14M7 4v12'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  />
                </svg>
                <span>Billing</span>
              </div>
              <div className='login-footer__feature'>
                <svg
                  viewBox='0 0 20 20'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <rect
                    x='3'
                    y='5'
                    width='14'
                    height='11'
                    rx='1'
                    stroke='currentColor'
                    strokeWidth='1.5'
                  />
                  <path
                    d='M7 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M10 9v4'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  />
                </svg>
                <span>Inventory</span>
              </div>
              <div className='login-footer__feature'>
                <svg
                  viewBox='0 0 20 20'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M14 13a4 4 0 0 1-8 0c0-2.5 2-4 4-4s4 1.5 4 4z'
                    stroke='currentColor'
                    strokeWidth='1.5'
                  />
                  <path
                    d='M10 9V5M8 7l2-2 2 2'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                <span>Pharmacy</span>
              </div>
            </div>
            <p className='login-footer__text'>
              A companion application for OpenMRS Reference Application
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
