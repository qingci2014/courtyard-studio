import {expect,it} from 'vitest';
import {fieldArchives} from '../app/moon-field-archives';
import {freshAdventure,restoreAdventure} from '../app/moon-adventure';
it('unlocks the recovered signal archive from existing saves without replay',()=>{const s=restoreAdventure({version:1,signal:'decoded',samples:[],studied:[]});const docs=fieldArchives(s);expect(docs.map(d=>d.id)).toEqual(['distant-echo']);expect(docs[0].sections.length).toBeGreaterThan(3);expect(fieldArchives(freshAdventure())).toEqual([]);});
it('lists only completed studies and adds the collection on completion',()=>{const s=freshAdventure();s.samples=['basalt','breccia','anorthosite'];s.studied=['basalt'];expect(fieldArchives(s).map(d=>d.id)).toEqual(['basalt']);s.studied=[...s.samples];expect(fieldArchives(s).map(d=>d.id)).toEqual(['basalt','breccia','anorthosite','lunar-geologist']);});
