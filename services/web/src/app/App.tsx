import { RouterProvider } from 'react-router-dom';
import { QueryProvider, router, ThemeProvider } from './providers';

const App = () => (
  <ThemeProvider>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </ThemeProvider>
);

export default App;
