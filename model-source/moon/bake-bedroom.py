"""Executed by build-bedroom.py -- --bake [--render].

Cycles irradiance atlas: direct + indirect diffuse, without surface colour.
TEXCOORD_0 stays dedicated to material detail; TEXCOORD_1 is the non-overlapping
lighting atlas. The source remains in work/bedroom/bedroom.blend.
"""
print('Preparing Cycles habitat lighting...',flush=True)
scene.render.engine='CYCLES';scene.cycles.samples=512
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.008
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=5;scene.cycles.transparent_max_bounces=12
scene.cycles.use_denoising=True
preferences=bpy.context.preferences.addons['cycles'].preferences
try:
    preferences.compute_device_type='OPTIX';preferences.get_devices()
    for device in preferences.devices:device.use=device.type=='OPTIX'
    if any(d.use for d in preferences.devices):scene.cycles.device='GPU'
except Exception as error:print('Cycles CPU fallback:',error,flush=True)
scene.world=bpy.data.worlds.new('Habitat quiet ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.65,.73,.82,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.025
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'

def area(name,position,target,power,sx,sy,color=(1,.83,.64)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='RECTANGLE';data.size=sx;data.size_y=sy
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=position;ob.rotation_euler=(Vector(target)-Vector(position)).to_track_quat('-Z','Y').to_euler();return ob

# Broad ceiling contribution and actual narrow sources tucked into each cove.
area('Ceiling indirect source',(0,28.45,3.32),(0,28.45,.20),175,2.3,2.0,(1,.94,.84))
area('Entrance indirect source',(0,24.0,3.32),(0,24,.20),120,2.3,1.8,(1,.94,.84))
for x in [-3.42,3.42]:
    area('Long ceiling cove',(x,27,3.245),(x*.62,27,.22),55,.06,9.5)
    area('Perimeter floor wash',(math.copysign(3.615,x),27,.24),(math.copysign(3.1,x),27,.20),7,.008,9.65)
area('Rear ceiling cove',(0,31.60,3.245),(0,30.1,1.6),35,6.70,.05)
for y in [23.02,24.93,26.84,28.75,30.66]:
    area('Library concealed shelf',(-3.16,y,2.43),(-3.23,y,1.58),7,.08,1.66)
for z in [1.84,2.57]:area('Niche warm light',(-.67,31.50,z+.269),(-.67,31.57,z-.26),2.3,.66,.045)
area('Headboard bounce',(-2.40,31.335,1.525),(-2.40,31.85,1.8),8,2.0,.035)
area('Bed floating plinth',(-1.36,29.7,.237),(-.9,29.7,.20),5,.012,2.7)
area('Bed foot wash',(-2.4,28.24,.237),(-2.4,27.85,.20),2,1.97,.01)
area('Worktop task light',(3.54,29.16,1.343),(2.5,29.16,1.035),9,.045,2.15)
area('Desk underside wash',(2.40,29.12,.925),(2.15,29.12,.23),5,.025,3.08)
area('Wardrobe rail',(3.06,25.74,3.158),(3.30,25.74,1.42),8,.065,1.03)

# The baking scene sees the same enclosed entrance as the game pressure shell.
# These occluders are not part of the insert export.
occluders=[]
for x in [-2.7,2.7]:occluders.append(box('bake entrance occluder',(x,21.96,1.80),(2.6,.12,3.28),wall,.02))
for x in [-1.4,1.4]:occluders.append(box('bake passage occluder',(x,20.20,1.80),(.12,3.45,3.28),wall,.02))
occluders.append(box('bake passage roof',(0,20.20,3.40),(2.85,3.45,.12),wall,.02))
occluders.append(box('bake passage floor',(0,20.20,.17),(2.85,3.45,.1),floor,.01))

# Joining here only creates a shared UV atlas; material groups remain separate
# on glTF export so their PBR properties can still be tuned independently.
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();room=bpy.context.object;room.name='Bedroom baked interior'
room['bedroom']=True;room['bakedLighting']=True
uv0=room.data.uv_layers[0];uv0.name='UVMap'
room.data.uv_layers.new(name='BakedGI');room.data.uv_layers.active_index=1
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.0015,margin_method='FRACTION',area_weight=1,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')

size=4096
baked=bpy.data.images.new('Habitat Cycles irradiance',width=size,height=size,alpha=True,float_buffer=True)
baked.colorspace_settings.name='Non-Color'
for material in room.data.materials:
    if not material:continue
    nodes=material.node_tree.nodes;links=material.node_tree.links
    # Preserve fabric and photographed garment coordinates during the UV1 bake.
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap'
    for node in list(nodes):
        if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:links.new(uv.outputs['UV'],node.inputs['Vector'])
    node=nodes.new('ShaderNodeTexImage');node.name='BAKE_TARGET';node.image=baked;nodes.active=node

print('Baking 4096px irradiance with',scene.cycles.device,'...',flush=True)
scene.render.bake.use_pass_color=False;scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},target='IMAGE_TEXTURES',margin=12,margin_type='EXTEND',use_clear=True,uv_layer='BakedGI')

# Keep a linear master for lossless re-encoding and lighting inspection.
scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='16';scene.render.image_settings.exr_codec='ZIP'
baked.save_render(str(WORK/'bedroom-irradiance.exr'),scene=scene)
pixels=np.empty(size*size*4,dtype=np.float32);baked.pixels.foreach_get(pixels);pixels=pixels.reshape((size,size,4))
rgb=np.maximum(0,pixels[:,:,:3]);print('Irradiance percentiles:',np.percentile(rgb,[50,95,99,99.9]).tolist(),flush=True)
gain=4.0

room.data.uv_layers.active_index=0
for layer in room.data.uv_layers:layer.active_render=layer.name=='UVMap'
# The target remains unconnected: only TEXCOORD_1 is exported, not a second copy
# of the atlas inside the GLB. The game loads the versioned atlas independently.
bpy.ops.object.select_all(action='DESELECT');room.select_set(True);bpy.context.view_layer.objects.active=room
bpy.ops.export_scene.gltf(filepath=str(OUT/'bedroom.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_vertex_color='NONE',export_all_vertex_colors=False)
print('Exported baked bedroom:',(OUT/'bedroom.glb').stat().st_size,'bytes',flush=True)
import hashlib
(OUT/'bedroom-lighting.json').write_text(json.dumps({'encoding':'srgb-scaled-irradiance','gain':gain,'uvChannel':1,'resolution':size,'modelSha256':hashlib.sha256((OUT/'bedroom.glb').read_bytes()).hexdigest()},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'bedroom-baked.blend'))
import runpy
runpy.run_path(str(ROOT/'model-source/moon/denoise-bedroom.py'))['denoise_atlas']()

if '--render' in sys.argv:
    data=bpy.data.cameras.new('Bedroom review');camera=bpy.data.objects.new('Bedroom review',data);scene.collection.objects.link(camera);scene.camera=camera
    camera.location=(-.25,25.40,1.95);camera.rotation_euler=(Vector((.15,30.0,1.53))-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=20.5
    scene.cycles.samples=128;scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='8';scene.render.filepath=str(WORK/'bedroom-cycles-v2.png')
    bpy.ops.render.render(write_still=True)
