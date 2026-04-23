import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryManagement from './InventoryManagement';

describe('<InventoryManagement />', () => {
  test('should mount', () => {
    render(<InventoryManagement />);

    const inventoryManagement = screen.getByTestId('InventoryManagement');

    expect(inventoryManagement).toBeInTheDocument();
  });
});