import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';

// No StrictMode: its dev-only double mount would start the 3D Tiles stream twice.
createRoot(document.getElementById('root')).render(<App />);
