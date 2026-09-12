import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FieldArchives} from '../app/moon-field-archives-panel';
import {AdventurePanel} from '../app/moon-adventure-panel';
import {Receiver} from '../app/moon-interface';
import {freshAdventure,type AdventureState} from '../app/moon-adventure';

describe('lunar terminal save and interaction contracts',()=>{
 it('does not expose a reward or cover before the archive is unlocked',()=>{
  const html=renderToStaticMarkup(<FieldArchives state={freshAdventure()} initialId="distant-echo"/>);
  expect(html).toContain('尚无已解锁档案');expect(html).not.toContain('archive-distant-echo-v1.png');expect(html).not.toContain('芯片记录');
 });
 it('opens the recovered story directly for an existing completed save',()=>{
  const state:AdventureState={...freshAdventure(),signal:'decoded'};
  const html=renderToStaticMarkup(<FieldArchives state={state} initialId="obsolete-id"/>);
  expect(html).toContain('archive-distant-echo-v1.png');expect(html).toContain('芯片记录');expect(html).toContain('远方的回声');expect(html).toContain('aria-pressed="true"');
 });
 it('keeps field tuning available only beside the detected probe',()=>{
  const state:AdventureState={...freshAdventure(),signal:'active'};
  const panel=(near:string)=>renderToStaticMarkup(<AdventurePanel state={state} signal={65} near={near} atLab={false} powered={true} onAction={()=>false} onClose={()=>{}}/>);
  expect(panel('')).not.toContain('aria-label="接收频率" type="range"');
  const beside=panel('signal');expect(beside).toContain('aria-label="接收频率"');expect(beside).toContain('回收存储芯片');expect(beside).toContain('disabled=""');
 });
 it('distinguishes an aligned receiver from an out of range reading',()=>{
  const ui=(value:number)=>renderToStaticMarkup(<Receiver value={value} min={140} max={145} target={142.4} step={.1} label="接收频率" unit="MHz" onChange={()=>{}}/>);
  expect(ui(142.4)).toContain('载波已锁定');expect(ui(142.3)).toContain('搜索载波');expect(ui(142.4)).toContain('min="140"');expect(ui(142.4)).toContain('max="145"');
 });
});
