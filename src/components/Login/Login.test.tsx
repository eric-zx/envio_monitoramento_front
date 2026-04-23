import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './Login';

describe('<Login />', () => {
  test('should mount', () => {
    render(<Login />);

    const login = screen.getByTestId('Login');

    expect(login).toBeInTheDocument();
  });
});