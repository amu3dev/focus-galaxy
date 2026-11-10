type OrbitBody = { id: string; name: string; urgency: number; importance: number };

// The existing radius/size semantics stay unchanged; only initial phase is adjusted.
export function orbitPoint(body: OrbitBody, angle: number, width: number, height: number) {
  const radius = (18 + (10 - body.urgency) * 2.9) / 100;
  const x = Math.cos(angle) * radius * width, y = Math.sin(angle) * radius * height;
  const rx = x * Math.cos(Math.PI/18) + y * Math.sin(Math.PI/18);
  const ry = y * Math.cos(Math.PI/18) - x * Math.sin(Math.PI/18);
  // Match the existing nested CSS perspectives, including the 6% scene lift.
  let py = ry * Math.cos(56*Math.PI/180) - height*.06;
  let z = ry * Math.sin(56*Math.PI/180), px = rx;
  const project = (distance: number) => {
    const scale = 1 / (1 - z / distance);
    px *= scale; py *= scale; z *= scale;
  };
  project(1400);
  py += height*.06;
  project(1400);
  py -= height*.06;
  if (width >= 1280) project(1600);
  return { x: px, y: py + height*.06 };
}

export function initialOrbitAngles(bodies: readonly OrbitBody[], width: number, height: number, previous = new Map<string, number>()) {
  const angles = new Map(bodies.filter(p=>previous.has(p.id)).map(p=>[p.id,previous.get(p.id)!]));
  const mobile = width < 1280;
  const occupied = bodies.filter(p=>angles.has(p.id)).map(p=>({ ...orbitPoint(p,angles.get(p.id)!,width,height), w:mobile?42:Math.max(52,p.name.length*3.7), h:mobile?42:66 }));
  for (const body of bodies) {
    if (angles.has(body.id)) continue;
    let hash=0;
    for (let i=0;i<body.id.length;i++) hash=((hash<<5)-hash+body.id.charCodeAt(i))|0;
    const preferred=(Math.abs(hash)%360)*Math.PI/180;
    const w=mobile?42:Math.max(52,body.name.length*3.7), h=mobile?42:66;
    let best=preferred, bestScore=-Infinity;
    // ponytail: bounded initial-phase search for small personal galaxies; a full
    // orbital collision solver is only warranted if dense live galaxies need it.
    for(let step=0;step<72;step++) {
      const candidate=preferred+step*Math.PI/36;
      const p=orbitPoint(body,candidate,width,height);
      const score=Math.min(
        Math.hypot(p.x/(w+90),p.y/(h+90)),
        (width/2-Math.abs(p.x))/w,
        (height*.44+p.y-80)/h,
        (height*.56-p.y-50)/h,
        ...occupied.map(other=>Math.hypot((p.x-other.x)/(w+other.w),(p.y-other.y)/(h+other.h))),
      );
      if(score>bestScore){bestScore=score;best=candidate;}
      if(score>=1.25)break;
    }
    angles.set(body.id,best);
    occupied.push({...orbitPoint(body,best,width,height),w,h});
  }
  return angles;
}
