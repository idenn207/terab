import { RouterProvider } from 'react-router-dom';
import { router } from './providers/router';
import { ThemeProvider } from './providers/theme';

const App = () => (
  <ThemeProvider>
    <RouterProvider router={router} />;
  </ThemeProvider>
);

export default App;
