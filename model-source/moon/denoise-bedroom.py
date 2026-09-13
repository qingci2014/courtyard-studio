"""Blender compositor denoising for the linear lighting-data atlas, not garment art."""
import bpy, numpy as np
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'work/bedroom'

def denoise_atlas():
    scene=bpy.data.scenes.new('Lighting atlas denoise')
    scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.render.resolution_x=4096;scene.render.resolution_y=4096;scene.render.resolution_percentage=100
    camera_data=bpy.data.cameras.new('Atlas compositor camera')
    camera=bpy.data.objects.new('Atlas compositor camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
    tree=bpy.data.node_groups.new('Habitat irradiance denoising','CompositorNodeTree')
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    scene.compositing_node_group=tree
    source=tree.nodes.new('CompositorNodeImage');source.image=bpy.data.images.load(str(WORK/'bedroom-irradiance.exr'),check_existing=False)
    denoise=tree.nodes.new('CompositorNodeDenoise')
    output=tree.nodes.new('NodeGroupOutput')
    tree.links.new(source.outputs['Image'],denoise.inputs['Image']);tree.links.new(denoise.outputs['Image'],output.inputs['Image'])
    scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='16';scene.render.image_settings.exr_codec='ZIP'
    scene.render.filepath=str(WORK/'bedroom-irradiance-denoised.exr')
    bpy.ops.render.render(scene=scene.name,write_still=True)
    result=bpy.data.images.load(scene.render.filepath,check_existing=False)
    pixels=np.empty(4096*4096*4,dtype=np.float32);result.pixels.foreach_get(pixels);pixels=pixels.reshape((4096,4096,4))
    gain=4.0;value=np.clip(np.maximum(0,pixels[:,:,:3])/gain,0,1)
    encoded=np.where(value<=.0031308,value*12.92,1.055*np.power(value,1/2.4)-.055)
    rgba=np.ones((4096,4096,4),dtype=np.float32);rgba[:,:,:3]=encoded
    image=bpy.data.images.new('Denoised habitat lighting',width=4096,height=4096,alpha=False,float_buffer=False);image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw=str(WORK/'bedroom-lighting.png');image.file_format='PNG';image.save()
    print('Denoised lighting atlas saved',flush=True)
    bpy.data.images.remove(source.image);bpy.data.images.remove(result);bpy.data.images.remove(image)
    bpy.data.scenes.remove(scene);bpy.data.node_groups.remove(tree);bpy.data.objects.remove(camera,do_unlink=True);bpy.data.cameras.remove(camera_data)

if __name__=='__main__':denoise_atlas()
