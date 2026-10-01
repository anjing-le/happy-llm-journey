import { renderToString } from 'react-dom/server';
import App from './App';
import Reader from './Reader';

export function render(initialPath?: string) {
  return renderToString(<App initialPath={initialPath} ReaderComponent={Reader} />);
}
