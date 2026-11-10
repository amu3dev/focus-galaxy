import assert from 'node:assert/strict';
import { initialOrbitAngles, orbitPoint } from '../src/lib/orbit-layout.ts';
import { galaxyTemplates } from '../src/lib/galaxy-templates.ts';

const planets=Array.from({length:6},(_,i)=>({id:`nearby-${i}`,name:`Priority ${i}`,importance:7,urgency:5}));
for(const [width,height] of [[1440,1000],[320,740]]){
  const angles=initialOrbitAngles(planets,width,height);
  const points=planets.map(p=>orbitPoint(p,angles.get(p.id),width,height));
  for(let i=0;i<points.length;i++){
    assert.ok(Math.hypot(points[i].x,points[i].y)>100,'Keep planet targets clear of the center');
    for(let j=0;j<i;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>64,'Separate initially colliding planet targets');
  }
  const next=initialOrbitAngles([...planets,{...planets[0],id:'new-planet'}],width,height,angles);
  for(const p of planets)assert.equal(next.get(p.id),angles.get(p.id),'Adding content must not move existing phases');
}
console.log('PASS initial collision separation, mobile targets and stable existing phases');
for (const [width,height] of [[1440,1000],[1440,900],[320,740],[390,844],[844,390]]) {
  for (const template of galaxyTemplates) for (const priority of template.priorities) {
    for (let degrees=0;degrees<360;degrees++) {
      const point=orbitPoint({...priority,id:'sample'},degrees*Math.PI/180,width,height);
      const x=width/2+point.x,y=height*.44+point.y;
      assert.ok(x>=24 && x<=width-24 && y>=100 && y<=height-44,`${template.id}/${priority.name}: complete orbit must stay reachable at ${width}x${height} (${degrees}deg)`);
    }
  }
}
console.log('PASS all template target orbits stay inside desktop/mobile viewports');
