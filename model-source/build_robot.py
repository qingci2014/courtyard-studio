import bpy, math, os
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, rgb, metal, rough, emission=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*emission,1);p.inputs['Emission Strength'].default_value=.8
    return m
silver=material('Titanium | satin silver',(.40,.44,.49),.88,.31)
edge=material('Machined edge | bright titanium',(.55,.60,.65),.95,.22)
black=material('Graphite | black steel',(.022,.028,.037),.85,.3)
rubber=material('Grip | dark elastomer',(.009,.013,.018),.1,.62)
steel=material('Piston | polished dark chrome',(.16,.20,.24),.98,.2)
blue=material('Light | ice cyan',(.012,.35,.55),.45,.28,(.012,.52,.8))
labelmat=material('Markings | graphite',(.024,.037,.05),.25,.5)
roots=[]
def group(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);roots.append(o);return o
def finish(o,name,mat,parent=None,bevel=0):
    o.name=name;o.data.materials.append(mat)
    if parent:o.parent=parent
    if bevel:
        b=o.modifiers.new('Machined bevel','BEVEL');b.width=bevel;b.segments=3
        b.limit_method='ANGLE'
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
        n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');n.keep_sharp=True;n.weight=40
    return o
def box(name,loc,scale,mat,parent=None,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)
def cyl(name,loc,radius,depth,mat,parent=None,axis='Z',vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    return finish(o,name,mat,parent,.012 if radius>.06 else .003)
def torus(name,loc,radius,thickness,mat,parent=None,axis='Z',start=0,end=math.tau):
    vertices=[];faces=[];N=64 if end-start>6 else 32;M=8
    for i in range(N+1):
        u=start+(end-start)*i/N
        for j in range(M):
            v=math.tau*j/M;x=(radius+thickness*math.cos(v))*math.cos(u);y=(radius+thickness*math.cos(v))*math.sin(u);z=thickness*math.sin(v)
            if axis=='X':x,y,z=z,y,x
            if axis=='Y':x,y,z=x,z,y
            vertices.append((x+loc[0],y+loc[1],z+loc[2]))
    for i in range(N):
        for j in range(M):a=i*M+j;b=i*M+(j+1)%M;faces.append((a,b,b+M,a+M))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent)
def cable(name,points,radius,mat,parent):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=3
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.parent=parent
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
def panel(name,sections,a0,a1,parent,mat=silver):
    # Lofted curved armour, with real wall thickness and chamfered perimeter.
    V=[];F=[];N=12
    for z,rx,ry in sections:
        for j in range(N+1):a=a0+(a1-a0)*j/N;V.append((rx*math.cos(a),ry*math.sin(a),z))
    for i in range(len(sections)-1):
        for j in range(N):a=i*(N+1)+j;F.append((a,a+1,a+N+2,a+N+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(V,[],F);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    solid=o.modifiers.new('Armour thickness','SOLIDIFY');solid.thickness=.045;solid.offset=0
    return finish(o,name,mat,parent,.022)
def bolt(parent,x,y,z,axis='Z',r=.025):
    cyl('Recess', (x,y,z),r*1.6,.012,black,parent,axis,24)
    o=cyl('Hex fastener',(x,y,z),r,.021,edge,parent,axis,6)
    return o
def text(parent,words,loc,size=.09):
    c=bpy.data.curves.new('Laser engraving','FONT');c.body=words;c.size=size;c.extrude=.0004;c.align_x='CENTER'
    o=bpy.data.objects.new('Engraving '+words,c);bpy.context.collection.objects.link(o);o.data.materials.append(labelmat);o.parent=parent;o.location=loc
    # Front face points toward Blender -Y / viewer +Z in Three.
    o.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)

def arm(name,radius):
    g=group(name)
    cyl('Internal spine',(0,0,0),radius*.46,2.83,black,g)
    for z in [-1.30,-1.12,1.08,1.29]:
        cyl('Structural collar',(0,0,z),radius*.68,.12,steel,g)
        torus('Collar rim',(0,0,z),radius*.70,.025,edge,g)
    for side in [-1,1]:
        # Exposed actuators continue through the opening between shell plates.
        cyl('Piston sleeve',(side*radius*.57,0,-.58),.09,.94,black,g)
        cyl('Piston rod',(side*radius*.57,0,.35),.042,1.28,edge,g)
        for z in [-.99,-.82,-.65,-.48]:torus('Actuator seal',(side*radius*.57,0,z),.091,.013,steel,g)
        cable('Braided tendon',[(side*radius*.32,radius*.52,-1.28),(side*radius*.65,radius*.69,-.6),(side*radius*.61,radius*.64,.5),(side*radius*.22,radius*.5,1.30)],.035,black,g)
        cable('Light conduit',[(side*radius*.30,-radius*.5,-1.03),(side*radius*.34,-radius*.53,0),(side*radius*.25,-radius*.48,1.02)],.014,blue,g)
    # Curved shield panels, widest near the elbow; narrow seams remain visible.
    sections=[(-1.15,radius*.53,radius*.53),(-.97,radius*.85,radius*.76),(-.58,radius,radius*.86),(.38,radius*.88,radius*.80),(.95,radius*.63,radius*.62),(1.12,radius*.44,radius*.47)]
    for n,(a,b) in enumerate([(12,76),(104,168),(192,256),(284,348)]):panel('Sculpted armour '+str(n),sections,math.radians(a),math.radians(b),g)
    # Overlapping smaller shoulder plates break the continuous cylinder silhouette.
    short=[(-1.27,radius*.51,radius*.53),(-1.08,radius*.78,radius*.77),(-.77,radius*.96,radius*.86),(-.64,radius*.93,radius*.82)]
    for a,b in [(27,72),(108,153),(207,252),(288,333)]:panel('Overlapping armour',short,math.radians(a),math.radians(b),g,edge)
    for z in [-.62,.64]:
        for side in [-1,1]:bolt(g,side*radius*.67,-radius*.60,z,'Y',.022)
    for i in range(6):
        o=box('Cooling louvre',(0,radius*.53,-.32+i*.10),(.26,.05,.034),steel,g,.006)
    text(g,'A I R  /  0 1' if name=='arm_upper' else 'N E X U S', (0,-radius*.61,-.26),.075)
    return g

def joint(name,r):
    g=group(name);cyl('Joint housing',(0,0,0),r,.64,black,g,'X')
    for side in [-1,1]:
        cyl('Bearing rim',(side*.32,0,0),r*.95,.075,steel,g,'X')
        cyl('Armour flange',(side*.36,0,0),r*.87,.052,silver,g,'X')
        cyl('Inset bearing',(side*.393,0,0),r*.67,.02,black,g,'X')
        torus('Ice blue bearing ring',(side*.407,0,0),r*.61,.017,blue,g,'X')
        torus('Inner machined ring',(side*.418,0,0),r*.44,.028,edge,g,'X')
        cyl('Hub',(side*.43,0,0),r*.28,.08,steel,g,'X',32)
        cyl('Hub center',(side*.48,0,0),r*.14,.025,black,g,'X',6)
        for i in range(8):
            a=math.tau*i/8;bolt(g,side*.397,math.sin(a)*r*.76,math.cos(a)*r*.76,'X',.022)
    return g

base=group('arm_base')
cyl('Mounting plate',(0,0,.08),.84,.16,black,base,8)
cyl('Base skirt',(0,0,.23),.74,.19,silver,base,8)
torus('Base light inset',(0,0,.335),.62,.017,blue,base)
cyl('Turntable',(0,0,.42),.57,.18,black,base)
cyl('Yaw bearing',(0,0,.56),.5,.1,steel,base)
for i in range(8):
    a=i*math.tau/8;bolt(base,.66*math.cos(a),.66*math.sin(a),.34,r=.04)
for side in [-1,1]:
    box('Shoulder support',(side*.4,0,.77),(.17,.56,.42),silver,base,.07)
    box('Shoulder support inset',(side*.495,0,.77),(.015,.32,.2),black,base,.02)
upper=arm('arm_upper',.53);fore=arm('arm_forearm',.45)
shoulder=joint('joint_shoulder',.43);elbow=joint('joint_elbow',.39);wrist=joint('joint_wrist',.27)
tool=group('arm_tool')
cyl('Tool swivel',(0,0,.06),.27,.2,black,tool)
torus('Tool status ring',(0,0,-.035),.265,.013,blue,tool)
box('Palm frame',(0,0,-.14),(.64,.42,.20),black,tool,.06)
box('Palm armour',(0,-.20,-.10),(.55,.10,.22),silver,tool,.05)
box('Tool rail',(0,0,-.24),(.89,.26,.075),steel,tool,.015)
cyl('Optical housing',(0,-.262,-.08),.065,.05,black,tool,'Y',24)
cyl('Optical glass',(0,-.292,-.08),.033,.009,blue,tool,'Y',24)
fingers=[]
for side,name in [(-1,'grip_left'),(1,'grip_right')]:
    g=group(name);g.parent=tool;fingers.append(g)
    for offset in ([-.13,.13] if side<0 else [0]):
        # Three articulated phalanges with recessed rubber contact pads.
        for i,(z,length,width) in enumerate([(-.06,.23,.15),(-.25,.20,.13),(-.405,.15,.115)]):
            x=-side*.045*i
            box('Finger skeleton',(x,offset,z),(.085,.13,length),black,g,.016)
            o=box('Finger dorsal armour',(x+side*.047,offset,z),(.08,.17,length*.76),silver,g,.027)
            cyl('Finger knuckle',(x,offset,z+length*.5),width*.46,.20,steel,g,'Y',24)
            cyl('Knuckle inset',(x,offset-.109,z+length*.5),width*.25,.013,black,g,'Y',20)
            box('Grip pad',(x-side*.042,offset,z),(.04,.13,length*.65),rubber,g,.012)
        box('Finger light',(side*.064,offset-.09,-.065),(.021,.008,.12),blue,g,.003)

# Pose matching the browser's rig. Blender Z-up converts to glTF Y-up.
def bvec(p):return Vector((p[0],-p[2],p[1]))
a=bvec((0,.97,-2.25));c=bvec((-.5,2.3,.5));d=c-a
up=Vector((0,0,1))-d*d.z/d.length_squared;up.normalize()
b=(a+c)/2+up*math.sqrt(3.25**2-d.length_squared/4)
for g,p,q in [(upper,a,b),(fore,b,c)]:g.location=(p+q)/2;g.rotation_mode='QUATERNION';g.rotation_quaternion=(q-p).to_track_quat('Z','Y')
axis=d.cross(up).normalized()
for g,p in [(shoulder,a),(elbow,b),(wrist,c)]:g.location=p;g.rotation_mode='QUATERNION';g.rotation_quaternion=Vector((1,0,0)).rotation_difference(axis)
base.location=(0,2.25,0);tool.location=bvec((-.5,2.1,.5))
fingers[0].location=(-.44,0,-.25);fingers[1].location=(.44,0,-.25)

# Apply modelling modifiers before export for identical web geometry.
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.context.scene.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        for mod in list(o.modifiers):
            try:bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception:pass
        o.select_set(False)
model_objects=list(bpy.context.scene.objects)
for o in model_objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/nexus-arm.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)

# Standalone material preview, with broad photographic softboxes, no bloom.
bpy.ops.object.select_all(action='DESELECT')
floor=material('Studio floor',(.023,.029,.037),.32,.4)
box('Studio plinth',(0,.4,-.19),(7.3,6.2,.3),floor,None,.15)
def area(name,location,power,size,color,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-4,-5,7),1100,5,(.88,.94,1),(0,1,2))
area('Rim softbox',(4,4,6),1500,3,(.67,.83,1),(0,1,2))
area('Front reflection',(1,-5,3),400,3,(1,1,1),(0,1,2))
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Studio world');scene.world.color=(.12,.12,.12)
bpy.ops.object.camera_add(location=(6.5,-9,6));cam=bpy.context.object;cam.rotation_euler=(Vector((0,1,2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.7;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'model-source/nexus-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'model-source/nexus-arm.blend'))
print('EXPORT_COMPLETE',len(model_objects),sum(len(o.data.polygons) for o in model_objects if o.type=='MESH'),flush=True)
bpy.ops.render.render(write_still=True)

