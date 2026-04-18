import { RouterProvider } from 'react-router-dom';
import { router, ThemeProvider } from './providers';

const App = () => (
  <ThemeProvider>
    <RouterProvider router={router} />;
  </ThemeProvider>
);

export default App;
