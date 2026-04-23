import { lazy, Suspense, ComponentProps } from 'react';

const LazyLogin = lazy(() => import('./Login'));

const Login = (props: ComponentProps<typeof LazyLogin>) => (
  <Suspense fallback={null}>
    <LazyLogin {...props} />
  </Suspense>
);

export default Login;
