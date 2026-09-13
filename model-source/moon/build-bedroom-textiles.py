"""Executed in the bedroom builder's namespace; settled textiles are cached locally."""
import hashlib

recipe=hashlib.sha256((ROOT/'model-source/moon/build-bedroom-textiles.py').read_bytes()).hexdigest()[:12]
cache=WORK/f'textiles-{recipe}.blend'
textiles=[]

def collision(ob,margin=.012):
    modifier=ob.modifiers.new('Textile contact','COLLISION')
    ob.collision.thickness_outer=margin;ob.collision.thickness_inner=.01;ob.collision.cloth_friction=12
    return modifier

def apply_modifier(ob,modifier):
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)

def settle(ob,frames,pin=None,bending=.5):
    scene.frame_set(1)
    modifier=ob.modifiers.new('Gravity-settled cloth','CLOTH');settings=modifier.settings
    settings.quality=8;settings.mass=.28;settings.air_damping=5
    settings.tension_stiffness=32;settings.compression_stiffness=32;settings.shear_stiffness=18
    settings.bending_stiffness=bending;settings.bending_damping=.5
    settings.tension_damping=5;settings.compression_damping=5;settings.shear_damping=5
    if pin:settings.vertex_group_mass=pin;settings.pin_stiffness=1
    contact=modifier.collision_settings;contact.use_collision=True;contact.distance_min=.012;contact.collision_quality=6
    contact.use_self_collision=True;contact.self_distance_min=.008;contact.self_friction=8
    modifier.point_cache.frame_start=1;modifier.point_cache.frame_end=frames
    for frame in range(1,frames+1):
        scene.frame_set(frame)
        # Force evaluation: frame_set alone does not evaluate an unobserved cloth modifier.
        ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().vertices[0].co
        ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
        if frame%20==0:print(ob.name,'cloth frame',frame,'/',frames,flush=True)
    apply_modifier(ob,modifier)
    smooth=ob.modifiers.new('Soft textile surface','SUBSURF');smooth.levels=1;smooth.render_levels=1;apply_modifier(ob,smooth)
    thick=ob.modifiers.new('Continuous padded textile hem','SOLIDIFY');thick.thickness=.023 if 'duvet' in ob.name else .009;thick.offset=0;thick.use_even_offset=True;apply_modifier(ob,thick)
    for p in ob.data.polygons:p.use_smooth=True
    zs=[v.co.z for v in ob.data.vertices]
    if min(zs)<.22 or max(zs)>1.65:raise RuntimeError(f'Unsettled textile bounds: {ob.name}: {min(zs)}, {max(zs)}')

if cache.exists():
    print('Loading settled textile geometry',recipe,flush=True)
    with bpy.data.libraries.load(str(cache),link=False) as (source,target):target.objects=source.objects
    for ob in target.objects:
        scene.collection.objects.link(ob);textiles.append(ob)
        for slot in ob.material_slots:
            if slot.material:
                name=slot.material.name.rsplit('.',1)[0] if slot.material.name[-3:].isdigit() else slot.material.name
                if name in bpy.data.materials:slot.material=bpy.data.materials[name]
else:
    contacts=[]
    for name in ['Bedroom rounded mattress','Bedroom bed monocoque base','Bedroom bed soft rim','Bedroom wall lining']:
        ob=bpy.data.objects[name];contacts.append((ob,collision(ob)))
    nu,nv=56,64
    def initial_duvet(u,v):
        anchor=max(0,min(1,(v-.74)/.26));anchor=anchor*anchor*(3-2*anchor)
        return (bx-1.28+u*2.74,28.0+v*2.66,1.255-.23*anchor+.013*math.sin(u*21+v*7)*(1-anchor))
    duvet_mesh=grid('settled percale duvet',nu,nv,initial_duvet,linen,(20,22))
    anchors=duvet_mesh.vertex_groups.new(name='Tucked beneath pillows')
    for j in [nv-1,nv]:
        for i in range(10,nu-9):anchors.add([j*(nu+1)+i],1 if j==nv else .6,'REPLACE')
    settle(duvet_mesh,100,anchors.name,.65);textiles.append(duvet_mesh)
    contacts.append((duvet_mesh,collision(duvet_mesh,.016)))
    throw_mesh=grid('settled charcoal throw',58,24,
        lambda u,v:(bx-1.245+u*2.64,28.43+v*.91,1.34+.012*math.sin(u*18+v*7)),throw,(20,8))
    settle(throw_mesh,100,bending=.25);textiles.append(throw_mesh)
    for ob,modifier in contacts:ob.modifiers.remove(modifier)
    scene.frame_set(1)
    bpy.data.libraries.write(str(cache),set(textiles),fake_user=True,compress=True)
    print('Saved settled duvet and throw:',cache.name,flush=True)

# A single closed rug: its sewn border is a material band on the same surface.
# Overall thickness is 11 mm, and its rear edge stays 37 cm clear of the cabinet.
rug_field=woven('Habitat | wool rug field',(.052,.057,.059),.96,1.4)
rug_binding=woven('Habitat | wool rug binding',(.065,.069,.069),.95,1.2)
rug_stitch=woven('Habitat | woven inset stripe',(.12,.13,.13),.96,1.1)
cx,cy=.22,28.22;width,length,radius=2.20,4.0,.16
def outline(inset):
    w=width-2*inset;h=length-2*inset;r=max(.025,radius-inset)
    return [(x+math.cos((k/16+q)*math.pi/2)*r,y+math.sin((k/16+q)*math.pi/2)*r)
        for q,(x,y) in enumerate([(w/2-r,h/2-r),(-w/2+r,h/2-r),(-w/2+r,-h/2+r),(w/2-r,-h/2+r)]) for k in range(17)]
rings=[(0,.217),(0,.220),(.009,.224),(.034,.227),(.040,.2274),(.045,.2277),(.08,.228)]
vertices=[]
for inset,z in rings:vertices.extend((cx+x,cy+y,z) for x,y in outline(inset))
n=68;faces=[];materials=[]
for ring in range(len(rings)-1):
    for i in range(n):
        j=(i+1)%n;faces.append((ring*n+i,ring*n+j,(ring+1)*n+j,(ring+1)*n+i));materials.append(2 if ring==3 else 1 if ring<3 else 0)
faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]);materials.extend([1,0])
mesh=bpy.data.meshes.new('Continuous textile rug');mesh.from_pydata(vertices,[],faces);mesh.update()
rug=bpy.data.objects.new('Bedroom single low-pile rug',mesh);scene.collection.objects.link(rug)
for material in [rug_field,rug_binding,rug_stitch]:mesh.materials.append(material)
uv=mesh.uv_layers.new(name='UVMap')
for polygon,material in zip(mesh.polygons,materials):
    polygon.material_index=material;polygon.use_smooth=True
    for loop in polygon.loop_indices:
        point=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=((point.x-cx)*10,(point.y-cy)*10)
assert cy+length/2<30.59-.30,'The rug must remain in front of the bedside cabinet'
