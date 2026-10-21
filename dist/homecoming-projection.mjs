// Foreshortened ground plane. Sprites remain upright; logical axial cells do not change.
export const GROUND_TILT=.74;
export const gardenBasis=([q,r])=>[Math.sqrt(3)*(q+r/2),1.5*r*GROUND_TILT];
export function gardenCell([screenX,screenY],origin,size){
  const x=(screenX-origin[0])/size,y=(screenY-origin[1])/size/GROUND_TILT;
  const q=Math.sqrt(3)/3*x-y/3,r=2*y/3;let a=Math.round(q),c=Math.round(r),b=Math.round(-q-r);
  const dx=Math.abs(a-q),dz=Math.abs(c-r),dy=Math.abs(b+q+r);
  if(dx>dy&&dx>dz)a=-b-c;else if(dy>dz)b=-a-c;else c=-a-b;
  return[a||0,c||0];
}
export const materialScale=level=>({1:.46,2:.53,3:.60,4:.66,5:.72,6:.78,7:.87})[level]||.72;
