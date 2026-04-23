import { lazy, Suspense, ComponentProps } from 'react';

const LazyInventoryManagement = lazy(() => import('./InventoryManagement'));

const InventoryManagement = (props: ComponentProps<typeof LazyInventoryManagement>) => (
  <Suspense fallback={null}>
    <LazyInventoryManagement {...props} />
  </Suspense>
);

export default InventoryManagement;
