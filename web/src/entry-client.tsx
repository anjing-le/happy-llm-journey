import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { decodeAnchor } from './navigation';
import './style.css';

const root = document.getElementById('root')!;
const initialPath = root.dataset.document ? decodeAnchor(root.dataset.document) : undefined;
const app = <App initialPath={initialPath} />;
if (root.childElementCount) hydrateRoot(root, app);
else createRoot(root).render(app);
