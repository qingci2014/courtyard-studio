"""SELENE warm habitat bedroom. Blender 5.1; metres, Z up.

Run: blender -b --python-exit-code 1 --python model-source/moon/build-bedroom.py
The existing base shell and all other rooms are retained by moon-bedroom.ts.
Only this independently authored insert is exported. No purchased assets.
"""
import bpy, math, random, json, sys, tempfile
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'moon/public/content'
WORK = ROOT / 'work/bedroom'
WORK.mkdir(parents=True, exist_ok=True)
(WORK/'temp').mkdir(exist_ok=True)
tempfile.tempdir=str(WORK/'temp')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(913)

def mat(name, color, metal=0, rough=.5, emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emit:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    return m

def texture(name, values, color=False):
    h,w=values.shape[:2];rgba=np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3]=values[:,:,None] if values.ndim==2 else values
    im=bpy.data.images.new(name,width=w,height=h)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    im.pixels.foreach_set(rgba.ravel());im.pack();return im

def woven(name,color,rough=.88,scale=1):
    m=mat(name,color,0,rough);n=256;y,x=np.mgrid[0:n,0:n];rng=np.random.default_rng(913)
    h=.5+.16*np.sin(x*math.tau/8)*np.cos(y*math.tau/8)+.06*rng.random((n,n))
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*scale;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*scale
    normal=np.dstack((-dx,-dy,np.ones_like(h)));normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=texture(name+' woven normals',normal*.5+.5)
    bump=nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.45
    links.new(tex.outputs['Color'],bump.inputs['Color']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
    tex=nodes.new('ShaderNodeTexImage');tex.image=texture(name+' yarn roughness',np.clip(.78+h*.17,0,1))
    links.new(tex.outputs['Color'],p.inputs['Roughness'])
    # Bake tint into the raster itself: Blender mix nodes are not portable glTF factors.
    rgb=np.array(color)[None,None,:]*(.89+h[:,:,None]*.13)
    srgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.power(rgb,1/2.4)-.055)
    tex=nodes.new('ShaderNodeTexImage');tex.image=texture(name+' yarn albedo',srgb,True)
    links.new(tex.outputs['Color'],p.inputs['Base Color']);return m

ivory=mat('Habitat | warm porcelain enamel',(.66,.64,.58),0,.43)
trim=mat('Habitat | soft ivory edge',(.77,.74,.66),0,.32)
wall=mat('Habitat | satin wall panels',(.55,.55,.52),0,.55)
floor=mat('Habitat | honed mineral floor',(.31,.32,.31),.08,.58)
dark=mat('Habitat | graphite gasket',(.018,.024,.026),0,.74)
ink=mat('Habitat | printed charcoal',(.055,.066,.066),0,.85)
metal=mat('Habitat | bead blasted titanium',(.26,.29,.29),.78,.36)
brass=mat('Habitat | champagne anodised trim',(.39,.30,.19),.7,.35)
linen=woven('Habitat | warm white percale',(.73,.70,.64))
linen_edge=woven('Habitat | percale piping',(.52,.50,.45))
throw=woven('Habitat | charcoal woven throw',(.035,.043,.047),.9,1.5)
seat=woven('Habitat | stone upholstery',(.28,.29,.27),.85)
rugmat=woven('Habitat | slate woven rug',(.032,.044,.051),.95,2)
rugedge=woven('Habitat | rug binding',(.15,.175,.17),.92)
led=mat('Habitat | warm opal diffuser',(.95,.76,.48),0,.3,2.8)
cyan=mat('Habitat | status phosphor',(.11,.47,.56),.1,.33,1)
glass=mat('Habitat | dark bonded display glass',(.008,.017,.022),.22,.19)
soil=mat('Habitat | soil substrate',(.045,.032,.019),0,1)
greens=[mat('Habitat | leaf '+str(i),c,0,.67) for i,c in enumerate([(.09,.16,.035),(.16,.235,.05),(.23,.30,.075),(.055,.12,.04)])]

# Fine powder-coat surface break-up, shared by all painted fittings.
rng=np.random.default_rng(831);grain=rng.random((128,128))
normal=np.dstack(((np.roll(grain,1,1)-grain)*.09+.5,(np.roll(grain,1,0)-grain)*.09+.5,np.ones_like(grain)))
paintnormal=texture('Satin enamel microtexture',normal)
for material in [ivory,trim,wall,floor]:
    n=material.node_tree.nodes;p=n.get('Principled BSDF');tex=n.new('ShaderNodeTexImage');tex.image=paintnormal
    uv=n.new('ShaderNodeUVMap');uv.uv_map='UVMap'
    mapping=n.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(32,32,32)
    material.node_tree.links.new(uv.outputs['UV'],mapping.inputs['Vector']);material.node_tree.links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
    bump=n.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.12
    material.node_tree.links.new(tex.outputs['Color'],bump.inputs['Color']);material.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    roughtex=n.new('ShaderNodeTexImage');roughtex.image=texture(material.name+' satin roughness',p.inputs['Roughness'].default_value+(grain-.5)*.055)
    material.node_tree.links.new(mapping.outputs['Vector'],roughtex.inputs['Vector']);material.node_tree.links.new(roughtex.outputs['Color'],p.inputs['Roughness'])

def box(name,loc,size,m,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='Bedroom '+name
    o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Machined edge radius','BEVEL');mod.width=bevel;mod.segments=4
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def cyl(name,loc,r,depth,m,axis=(0,0,1),verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc)
    o=bpy.context.object;o.name='Bedroom '+name;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    be=o.modifiers.new('Turned edge','BEVEL');be.width=min(.009,depth*.16,r*.13);be.segments=3
    o.modifiers.new('Weighted normal','WEIGHTED_NORMAL')
    for p in o.data.polygons:p.use_smooth=True
    return o

def rod(name,a,b,r,m):
    a,b=Vector(a),Vector(b);return cyl(name,(a+b)/2,r,(a-b).length,m,b-a,16)

def path(name,pts,r,m):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=1;data.bevel_depth=r;data.bevel_resolution=2
    poly=data.splines.new('POLY');poly.points.add(len(pts)-1)
    for p,co in zip(poly.points,pts):p.co=(*co,1)
    o=bpy.data.objects.new('Bedroom '+name,data);scene.collection.objects.link(o);o.data.materials.append(m);return o

def sphere(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=loc)
    o=bpy.context.object;o.name='Bedroom '+name;o.scale=scale;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def text(name,body,loc,size,m,rot=(math.pi/2,0,0),align='LEFT'):
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.size=size;data.align_x=align;data.space_character=1.15
    o=bpy.data.objects.new('Bedroom '+name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;data.materials.append(m);o['surfaceLabel']=True;return o

def grid(name,nu,nv,fn,m,uv=(1,1),thickness=0):
    vs=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    fs=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('Bedroom '+name,mesh);scene.collection.objects.link(o);mesh.materials.append(m)
    layer=mesh.uv_layers.new()
    for p in mesh.polygons:
        p.use_smooth=True
        for k in p.loop_indices:
            idx=mesh.loops[k].vertex_index;layer.data[k].uv=(idx%(nu+1)/nu*uv[0],idx//(nu+1)/nv*uv[1])
    if thickness:
        mod=o.modifiers.new('Hem thickness','SOLIDIFY');mod.thickness=thickness
    return o

def screw(loc,axis=(0,-1,0)):
    o=cyl('flush fastener',loc,.014,.004,metal,axis,12)
    # Recessed socket is geometry, never a floating printed dash.
    v=Vector(loc)+Vector(axis)*.0024;cyl('hex socket',v,.005,.0015,dark,axis,6)

def drawer(loc,size,m=ivory,side=False,facing=-1):
    x,y,z=loc;w,d,h=size
    box('drawer reveal',loc,(w+.015,d+.008,h+.015),dark,.035)
    face_x=x+facing*.012 if side else x
    box('flush drawer face',(face_x,y-.01 if not side else y,z),(w,d,h),m,.031)
    if side:
        box('recessed drawer grip',(face_x+facing*(w/2+.001),y,z+h*.15),(.006,min(.32,d*.45),.055),dark,.024)
    else:box('recessed drawer grip',(x,y-d/2-.013,z+h*.16),(min(.34,w*.5),.009,.05),dark,.02)

def rounded_frame(name,loc,w,h,depth,r,thickness,m):
    x,y,z=loc;vs=[]
    def outline(w,h,r):
        return [(cx+math.cos((k/8+q)*math.pi/2)*r,cz+math.sin((k/8+q)*math.pi/2)*r) for q,(cx,cz) in enumerate([(w/2-r,h/2-r),(-w/2+r,h/2-r),(-w/2+r,-h/2+r),(w/2-r,-h/2+r)]) for k in range(9)]
    for yy in [-depth/2,depth/2]:
        for ww,hh,rr in [(w,h,r),(w-2*thickness,h-2*thickness,r-thickness)]:vs.extend((x+xx,y+yy,z+zz) for xx,zz in outline(ww,hh,rr))
    n=36;fs=[]
    for i in range(n):
        j=(i+1)%n;fs.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('Bedroom '+name,mesh);scene.collection.objects.link(o);mesh.materials.append(m)
    return o

def plant(x,y,z,w=.32,h=.38,seed=1):
    rng=random.Random(seed);box('ceramic herb planter',(x,y,z+.085),(w,w*.72,.17),ivory,.025)
    box('planter soil',(x,y,z+.171),(w-.025,w*.72-.025,.012),soil,.01)
    for k in range(11):
        a=rng.random()*math.tau;dist=rng.random()*w*.32;xx=x+math.cos(a)*dist;yy=y+math.sin(a)*dist
        ht=h*(.5+rng.random()*.5);lean=Vector((math.cos(a)*.055,math.sin(a)*.055,ht))
        start=Vector((xx,yy,z+.18));rod('herb stem',start,start+lean,.0025,greens[0])
        for j in range(6):
            aa=a+j*2.4;base=start+lean*(.16+j*.15);length=.075+rng.random()*.055;width=length*.37
            direction=Vector((math.cos(aa),math.sin(aa),.45));across=Vector((-math.sin(aa),math.cos(aa),0))
            def leaf(u,v,base=base,direction=direction,across=across,length=length,width=width):
                p=base+direction*(u*length)+across*((v-.5)*2*width*math.sin(math.pi*u));p.z+=.022*math.sin(math.pi*u)*(1-abs(v-.5)*2);return p
            grid('curved herb leaf',6,2,leaf,greens[(k+j)%4])

# Quiet continuous shell: rounded panel faces sit inside the retained pressure hull.
box('floor substrate',(0,27,.182),(7.68,9.98,.035),dark,.012)
for x in [-2.875,-.958,.958,2.875]:
    for y in [23,25,27,29,31]:box('mineral floor panel',(x,y,.203),(1.905,1.987,.026),floor,.012)
for x in [-3.79,3.79]:
    box('wall lining',(x,27,1.84),(.13,10.05,3.25),wall,.045)
    box('lower service rail',(x*.981,27,.36),(.14,10,.25),ivory,.035)
    box('recessed footlight channel',(x*.967,27,.233),(.055,9.82,.05),dark,.016)
    box('concealed floor wash',(x*.959,27,.242),(.012,9.76,.016),led,.005)
    for y in [23.7,25.7,27.7,29.7,31.1]:
        box('flush sidewall panel',(x*.989,y,1.96),(.08,1.973,2.86),ivory,.045)
        for z in [.58,3.25]:screw((x*.976,y-.87,z),(1 if x<0 else -1,0,0))
box('back lining',(0,31.94,1.84),(7.68,.16,3.25),wall,.06)
# Match the entrance bulkhead to the interior finish while keeping the passage open.
for x in [-2.67,2.67]:
    box('entrance wall liner',(x,22.025,1.84),(2.49,.055,3.25),wall,.035)
    box('entrance flush panel',(x,22.06,1.98),(2.37,.035,2.86),ivory,.04)
    box('entrance lower service rail',(x,22.10,.36),(2.47,.10,.25),ivory,.025)
    for dx in [-1.07,1.07]:
        for z in [.60,3.25]:screw((x+dx,22.081,z),(0,1,0))
for x,w in [(-2.45,2.51),(-.57,1.2),(1.31,2.5),(3.19,1.2)]:
    box('rear upper panel',(x,31.823,2.59),(w-.017,.07,1.49),ivory,.047)
    for dx in [-w/2+.08,w/2-.08]:screw((x+dx,31.784,3.22))
for x in [-2.78,-.94,.94,2.78]:
    box('ceiling panel',(x,27,3.435),(1.825,9.9,.13),ivory,.055)
    for y in [23,26,29,31]:screw((x+.7,y,3.367),(0,0,-1))
for x in [-3.43,3.43]:
    box('upper cove shadow',(x,27,3.30),(.13,9.85,.07),dark,.025)
    box('upper opal light',(x,27,3.258),(.07,9.78,.012),led,.005)
box('rear cove reveal',(0,31.59,3.30),(6.82,.14,.07),dark,.022)
box('rear cove light',(0,31.60,3.258),(6.77,.064,.012),led,.005)
# Circular air return: concentric rings, actual radial support and blades.
cx,cy=0,28.5
cyl('ceiling ventilation bezel',(cx,cy,3.365),.63,.054,trim)
cyl('ventilation dark well',(cx,cy,3.33),.535,.045,dark)
for rr in [.555,.581]:
    path('vent light ring',[(cx+rr*math.cos(a*math.tau/128),cy+rr*math.sin(a*math.tau/128),3.322) for a in range(129)],.009,led)
for rr in [.18,.23,.28,.33,.38,.43,.48,.51]:
    path('air intake concentric grille',[(cx+rr*math.cos(a*math.tau/96),cy+rr*math.sin(a*math.tau/96),3.30) for a in range(97)],.006,metal)
for k in range(8):
    a=k*math.tau/8;rod('grille radial brace',(cx+.1*math.cos(a),cy+.1*math.sin(a),3.305),(cx+.52*math.cos(a),cy+.52*math.sin(a),3.305),.006,ink)
cyl('fan centre cap',(cx,cy,3.29),.12,.025,metal)

# Bed platform with real drawer fronts and a recessed plinth.
bx,by=-2.40,29.70
box('bed recessed plinth',(bx,by,.32),(1.94,2.64,.21),dark,.09)
box('bed monocoque base',(bx,by,.50),(2.13,2.93,.47),ivory,.11)
box('bed soft rim',(bx,by,.752),(2.16,2.96,.064),trim,.09)
box('mattress underside gasket',(bx,by,.779),(1.955,2.71,.025),dark,.10)
box('rounded mattress',(bx,by,.858),(1.96,2.70,.18),linen,.085)
for yy in [28.97,30.40]:drawer((bx+1.068,yy,.49),(.045,1.31,.31),side=True,facing=1)
drawer((bx,by-1.472,.50),(1.89,.05,.31))
box('bed underside light',(bx+1.036,by,.253),(.016,2.73,.021),led,.007)
box('bed foot light',(bx,by-1.447,.253),(1.98,.016,.02),led,.007)
box('bed headboard frame',(bx,31.21,1.075),(2.20,.18,1.0),trim,.12)
box('bed headboard shadow',(bx,31.104,1.12),(2.05,.075,.79),dark,.1)
box('bed padded headboard',(bx,31.055,1.14),(1.99,.08,.73),seat,.085)
for xx in [bx-.61,bx+.61]:path('headboard seam',[(xx,31.011,.86),(xx,31.011,1.42)],.002,linen_edge)
path('headboard halo',[(bx-1.055,31.105,.74),(bx-1.055,31.105,1.40),(bx-1.01,31.105,1.50),(bx+1.01,31.105,1.50),(bx+1.055,31.105,1.40),(bx+1.055,31.105,.74)],.012,led)

# Real gravity-settled duvet/throw and a continuous low-pile rug.
exec(compile((ROOT/'model-source/moon/build-bedroom-textiles.py').read_text(encoding='utf-8'),'build-bedroom-textiles.py','exec'),globals())
if '--textile-only' in sys.argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'textile-geometry-review.blend'))
    raise SystemExit(0)

# Full inflated pillows, pinched corners, gathered seams and uneven depressions.
for idx,px in enumerate([bx-.47,bx+.45]):
    def pillow(u,v,px=px,idx=idx):
        a=2*u-1;b=2*v-1;loft=max(0,(1-a*a)*(1-b*b))**.53
        z=1.008+.22*loft-.034*math.exp(-((a-.25)**2+(b+.12)**2)*9)
        z+=.009*math.sin(a*29+b*11)*(abs(b)**4)+.007*math.sin(b*28-a*7)*abs(a)**4
        return (px+a*.445+b*.025,30.66+b*.31+a*.025*(idx*2-1),z)
    grid('plump stitched pillow '+str(idx),68,48,pillow,linen,(8,6),.038)
    for side in [0,1]:path('pillow piped seam',[pillow(i/68,side) for i in range(69)],.0035,linen_edge)
    for side in [0,1]:path('pillow end seam',[pillow(side,i/48) for i in range(49)],.0035,linen_edge)

# Bedside storage and a softly luminous cratered globe on a metal stand.
drawer((-.78,30.93,.615),(.79,.68,.77))
box('bedside top',(-.78,30.93,1.022),(.84,.72,.045),trim,.06)
plant(-1.02,30.99,1.045,.22,.23,9)
cyl('moon lamp weighted foot',(-.61,30.92,1.066),.135,.042,brass)
cyl('moon lamp neck',(-.61,30.92,1.112),.036,.066,metal)
moon=mat('Habitat | porcelain moon lamp',(.73,.66,.49),0,.65,.65)
n=256;yy,xx=np.mgrid[0:n,0:n];rng=np.random.default_rng(147);height=np.zeros((n,n))+.6
for k in range(70):
    cx,cy=rng.uniform(0,n,2);rr=rng.uniform(3,22);dist=np.sqrt((xx-cx)**2+(yy-cy)**2)/rr
    height-=.14*np.exp(-dist**6*3);height+=.12*np.exp(-((dist-.93)/.12)**2)
moontex=texture('Moon globe crater albedo',np.clip(height,.15,.92),True)
nt=moon.node_tree.nodes.new('ShaderNodeTexImage');nt.image=moontex;p=moon.node_tree.nodes.get('Principled BSDF')
moon.node_tree.links.new(nt.outputs['Color'],p.inputs['Base Color'])
sphere('cratered moon bedside lamp',(-.61,30.92,1.322),(.19,.19,.19),moon)

# Rear headwall: flush cabinet doors with generous radii, illuminated botanic niches.
for xx in [-2.96,-1.84]:drawer((xx,31.735,2.14),(1.105,.11,1.05))
text('room identification','L U N A R  B A S E  /  0 1',(-3.25,31.66,3.01),.107,ink)
text('room subheading','CREW HABITAT     /     REST & RECOVER',(-3.25,31.66,2.83),.043,ink)
for zz in [1.84,2.57]:
    rounded_frame('recessed botanic niche',(-.67,31.65,zz),.94,.68,.32,.12,.048,trim)
    box('niche warm rear',(-.67,31.795,zz),(.81,.024,.55),wall,.08)
    box('niche shelf',(-.67,31.54,zz-.275),(.79,.43,.039),trim,.025)
    box('niche overhead light',(-.67,31.49,zz+.275),(.68,.055,.016),led,.006)
    plant(-.67,31.52,zz-.25,.40,.29,int(zz*8))
drawer((1.05,31.705,.62),(2.35,.24,.76))
text('quiet cabin caption','QUIETER NIGHTS.\nBRIGHTER TOMORROWS.',(.06,31.555,1.54),.083,ink)
for xx in [.09,.165,.24,.315,.39,.465,.54,.615]:box('service cabinet vent',(xx,31.558,.43),(.028,.003,.065),dark,.01)

# Right-hand workspace, with integrated glass input and an inset large display.
box('long workstation plinth',(3.05,29.12,.32),(1.38,3.30,.2),dark,.06)
box('workstation ceramic top',(2.99,29.12,.987),(1.48,3.42,.085),ivory,.08)
box('desktop front radius',(2.25,29.12,.973),(.035,3.20,.036),trim,.017)
box('desk underlight',(2.40,29.12,.928),(.025,3.18,.016),led,.006)
for yy in [27.75,30.49]:
    box('workstation integrated pedestal',(3.04,yy,.586),(1.25,.66,.69),ivory,.075)
    for zz in [.42,.74]:drawer((2.4,yy,zz),(.032,.54,.24),side=True)
box('secondary touch glass',(2.99,29.12,1.036),(1.34,3.25,.012),glass,.015)
# Runtime replaces this face material with the live environmental display.
box('wide display backing',(3.637,29.16,2.15),(.18,2.49,1.57),trim,.09)
box('wide display gasket',(3.537,29.16,2.15),(.043,2.36,1.44),dark,.065)
screen=box('wide display glass',(3.509,29.16,2.15),(.012,2.25,1.32),glass,.032);screen['bedroomScreen']='main'
box('display lower indirect light',(3.57,29.16,1.35),(.075,2.21,.024),led,.01)
# Soft, tucked-in desk chair; connected seat, back, arms and recessed pedestal.
cyl('chair base',(1.92,29.2,.253),.34,.055,metal)
cyl('chair column',(1.92,29.2,.46),.051,.4,metal)
box('chair seat shell',(1.97,29.2,.665),(.68,.66,.09),ivory,.075)
box('chair seat pad',(1.97,29.2,.73),(.60,.595,.084),seat,.075)
box('chair lumbar shell',(1.65,29.2,1.035),(.09,.66,.76),ivory,.065)
box('chair lumbar upholstery',(1.709,29.2,1.065),(.068,.57,.60),seat,.04)
for yy in [28.88,29.52]:
    rod('chair arm support',(1.77,yy,.68),(1.77,yy,.91),.018,metal)
    box('chair padded arm',(1.93,yy,.93),(.37,.065,.049),seat,.025)
plant(3.15,30.39,1.036,.48,.39,30)
for k,(yy,col) in enumerate([(27.96,ink),(28.12,wall),(28.25,throw)]):
    o=box('field notebook',(3.13,yy,1.065+k*.012),(.37,.24,.022),col,.012);o.rotation_euler.z=.09*(k-1)
cyl('reusable mug',(2.90,28.12,1.135),.076,.19,metal)
cyl('mug dark interior',(2.90,28.12,1.233),.064,.004,dark)
path('mug handle',[(2.90+.102*math.sin(i*math.pi/20),28.12,1.136+.064*math.cos(i*math.pi/20)) for i in range(21)],.014,metal)

# Tall integrated locker: recessed hanging bay above a closed lower cabinet.
wx,wy=3.22,25.74
box('wardrobe rear shell',(3.68,wy,1.73),(.12,1.29,3.02),ivory,.04)
box('wardrobe dark hanging recess',(3.607,wy,2.195),(.026,1.105,1.805),dark,.018)
for yy in [wy-.604,wy+.604]:box('wardrobe full height jamb',(wx,yy,1.735),(.86,.103,3.02),trim,.034)
for zz in [.244,1.255,3.213]:box('wardrobe structural shelf',(wx,wy,zz),(.86,1.29,.058),trim,.024)
box('wardrobe concealed opal light',(3.06,wy,3.174),(.045,1.08,.013),led,.005)
rod('wardrobe hanger rail',(3.22,wy-.49,2.954),(3.22,wy+.49,2.954),.013,brass)
# Closed storage has its own inset face, reveal and recessed handhold.
box('wardrobe lower storage body',(3.33,wy,.739),(.60,1.08,.96),ivory,.032)
box('wardrobe lower door reveal',(2.855,wy,.747),(.06,1.125,.98),dark,.028)
box('wardrobe lower closed door',(2.830,wy,.747),(.046,1.092,.952),ivory,.022)
box('wardrobe recessed grip bezel',(2.803,wy,.487),(.010,.57,.063),metal,.009)
box('wardrobe recessed grip shadow',(2.797,wy,.489),(.004,.515,.025),dark,.002)
text('wardrobe lower caption','LIFE\nWORK\nEXPLORE\nREPEAT',(2.804,wy+.39,1.105),.040,ink,(math.pi/2,0,-math.pi/2))
text('wardrobe unit marking','CREW / 01',(2.782,wy+.47,3.13),.039,ink,(math.pi/2,0,-math.pi/2))
for k in range(3):
    box('wardrobe folded equipment case',(3.02,wy-.22+k*.025,1.316+k*.054),(.34,.39-k*.035,.044),dark,.008)
    box('wardrobe case latch',(2.845,wy-.26+k*.025,1.316+k*.054),(.008,.09,.012),metal,.003)

garment=mat('Habitat | photo textile crew jacket',(.8,.8,.8),0,.86)
garment_image=bpy.data.images.load(str(Path(__file__).parent/'textures/crew-jacket-v1.png'));garment_image.pack()
tex=garment.node_tree.nodes.new('ShaderNodeTexImage');tex.image=garment_image
p=garment.node_tree.nodes.get('Principled BSDF');garment.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);garment.node_tree.links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
garment.surface_render_method='DITHERED'
if hasattr(garment,'use_transparent_shadow'):garment.use_transparent_shadow=True
for k,yy in enumerate([wy-.215,wy+.215]):
    angle=math.radians(-10 if k==0 else 7)
    grid('textured hanging crew jacket '+str(k),20,32,
        lambda u,v,yy=yy,k=k,angle=angle:(3.26-k*.13+(u-.5)*.77*math.sin(angle)-.05*math.sin(u*math.pi)*math.sin(v*math.pi),yy+(.5-u)*.77*math.cos(angle),1.704+v*1.30),garment)

# The entrance-side corner is intentionally empty while the user chooses its use.

# Left storage/reading wall unifies the otherwise empty front half of the cabin.
for yy in [23.02,24.93,26.84,28.75,30.66]:
    box('overhead flush locker',(-3.38,yy,2.955),(.74,1.91,.78),ivory,.09)
    box('upper locker split',(-2.999,yy,2.97),(.005,.008,.59),dark,.002)
    box('shelf recess',(-3.52,yy,2.02),(.36,1.78,.94),dark,.055)
    box('shelf back ceramic',(-3.655,yy,2.03),(.055,1.72,.87),wall,.027)
    for zz in [1.58,2.47]:box('rounded floating shelf',(-3.28,yy,zz),(.94,1.83,.048),trim,.024)
    box('shelf concealed light',(-3.13,yy,2.434),(.044,1.65,.014),led,.005)
    plant(-3.30,yy-.33,1.604,.40,.37,int(yy))
    for k in range(5):
        o=box('mission library volume',(-3.28,yy+.17+k*.069,1.82),(.34,.057,.42),[ink,wall,seat][k%3],.009)
        if k==4:o.rotation_euler.x=.10
        box('book spine emboss',(-3.104,yy+.17+k*.069,1.90),(.003,.032,.005),brass,.001)
box('reading storage bench',(-3.25,24.90,.475),(1.02,3.58,.50),ivory,.095)
box('reading bench upholstery',(-3.23,24.90,.78),(.89,3.38,.17),seat,.075)
for yy in [23.86,24.94,26.02]:drawer((-2.731,yy,.48),(.022,1.00,.32),side=True,facing=1)

# Environmental control panel next to the large display, separate readable surface.
box('environment display surround',(3.65,27.27,2.18),(.13,.44,1.04),trim,.054)
o=box('environment display glass',(3.576,27.27,2.18),(.015,.355,.91),glass,.023);o['bedroomScreen']='status'

colliders=[
    {'id':'bedroom-bed','x':bx,'z':-by,'hx':1.09,'hz':1.49},
    {'id':'bedroom-bedside','x':-.78,'z':-30.93,'hx':.43,'hz':.37},
    {'id':'bedroom-desk','x':2.99,'z':-29.12,'hx':.76,'hz':1.73},
    {'id':'bedroom-chair','x':1.95,'z':-29.2,'hx':.39,'hz':.37},
    {'id':'bedroom-wardrobe','x':3.22,'z':-25.74,'hx':.44,'hz':.65},
    {'id':'bedroom-bench','x':-3.25,'z':-24.9,'hx':.53,'hz':1.82},
    {'id':'bedroom-back-storage','x':1.05,'z':-31.70,'hx':1.20,'hz':.16},
]
(OUT/'bedroom-layout.json').write_text(json.dumps({'colliders':colliders},indent=2)+'\n')

# Export actual surface detail (including bevels/curves), not Blender-only shader nodes.
print('Converting bedroom surfaces...',flush=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
objects=list(scene.objects)
for o in objects:
    o['bedroom']=True
    bpy.context.view_layer.objects.active=o
    # All modifiers were evaluated by conversion; UVs are stable for cloth normals.
    if not o.data.uv_layers:o.data.uv_layers.new()
    if len(o.data.vertices)<500 and any(m and any(word in m.name for word in ['woven rug','rug binding','upholstery','percale']) for m in o.data.materials):
        for uv in o.data.uv_layers.active.data:uv.uv*=12

# Local ambient occlusion in vertex colours, to retain contact and seam shading in WebGL.
if '--no-ao' not in sys.argv and '--bake' not in sys.argv:
    print('Baking local contact occlusion into vertices...',flush=True)
    vertices=[];faces=[]
    for o in objects:
        off=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
        faces.extend(tuple(off+i for i in p.vertices) for p in o.data.polygons)
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=False)
    dirs=[Vector((math.cos(k*2.39996)*math.sqrt((k+.5)/7),math.sin(k*2.39996)*math.sqrt((k+.5)/7),math.sqrt(1-(k+.5)/7))) for k in range(7)]
    for oi,o in enumerate(objects):
        if o.get('surfaceLabel') or any(m and ('diffuser' in m.name or 'phosphor' in m.name or 'lamp' in m.name or 'leaf' in m.name) for m in o.data.materials):continue
        colors=o.data.color_attributes.new(name='Contact occlusion',type='BYTE_COLOR',domain='POINT')
        matrix=o.matrix_world;normalmatrix=matrix.to_3x3().inverted().transposed()
        values=[]
        for v in o.data.vertices:
            p=matrix@v.co;normal=(normalmatrix@v.normal).normalized();rot=normal.to_track_quat('Z','Y');occ=0
            for d in dirs:
                hit,_,_,distance=tree.ray_cast(p+normal*.008,rot@d,.65)
                if hit is not None:occ+=max(0,1-distance/.65)
            ao=max(.45,1-occ/7*.60);values.extend((ao,ao,ao,1))
        colors.data.foreach_set('color',values)
        if oi%200==0:print('Contact shading',oi,'/',len(objects),flush=True)

bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'bedroom.blend'))
if '--bake' in sys.argv:
    exec((Path(__file__).parent/'bake-bedroom.py').read_text(encoding='utf-8'),globals())
else:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/'bedroom.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    print('Exported bedroom.glb:',(OUT/'bedroom.glb').stat().st_size,flush=True)

if '--render' in sys.argv and '--bake' not in sys.argv:
    # Diagnostic only: browser review remains the authority for game appearance.
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Habitat review environment');scene.world.color=(.13,.14,.15)
    for x,y,z,power,size in [(0,28.2,3.23,420,3),(-2,30,2.7,90,1),(2.3,28.8,2.7,110,1),(0,24,3.2,260,3)]:
        data=bpy.data.lights.new('Review soft source','AREA');data.energy=power;data.color=(1,.83,.64);data.shape='DISK';data.size=size
        o=bpy.data.objects.new('Review light',data);scene.collection.objects.link(o);o.location=(x,y,z)
    data=bpy.data.cameras.new('Bedroom review');cam=bpy.data.objects.new('Bedroom review',data);scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(.1,25.75,1.75);cam.rotation_euler=(Vector((-.10,30.1,1.45))-cam.location).to_track_quat('-Z','Y').to_euler();data.lens=20
    scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.filepath=str(WORK/'bedroom-review.png')
    bpy.ops.render.render(write_still=True)
