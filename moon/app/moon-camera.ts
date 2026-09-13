const radians=Math.PI/180;

// A vertical limit alone still produces extreme peripheral stretching on ultrawide screens.
export function worldCameraFov(requested:number,aspect:number):number{
 const vertical=Math.max(30,Math.min(85,Number.isFinite(requested)?requested:64));
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1;
 const horizontalLimit=2*Math.atan(Math.tan(105*radians/2)/ratio)/radians;
 return Math.min(vertical,horizontalLimit);
}

export function scrollCameraFov(current:number,delta:number,aspect:number):number{
 return worldCameraFov(worldCameraFov(current,aspect)+Math.max(-240,Math.min(240,delta))*.04,aspect);
}
