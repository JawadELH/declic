import { useSearchParams } from 'react-router-dom';
import { useSocial } from '../hooks/useSocial.jsx';
import GroupLive from './GroupLive.jsx';
import Allies from './Allies.jsx';
import Circles from './Circles.jsx';

const VIEWS = [
  { id: 'direct', label: 'En direct' },
  { id: 'allies', label: 'Alliés' },
  { id: 'cercles', label: 'Cercles' },
];

export default function Group() {
  const [params, setParams] = useSearchParams();
  const { incoming } = useSocial();
  const view = VIEWS.some((v) => v.id === params.get('vue')) ? params.get('vue') : 'direct';
  return (
    <div className="page group">
      <h1>Groupe</h1>
      <div className="segmented" role="tablist">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => setParams(v.id === 'direct' ? {} : { vue: v.id }, { replace: true })}>
            {v.label}
            {v.id === 'allies' && incoming.length > 0 && <span className="count">{incoming.length}</span>}
          </button>
        ))}
      </div>
      {view === 'direct' && <GroupLive />}
      {view === 'allies' && <Allies />}
      {view === 'cercles' && <Circles />}
    </div>
  );
}
