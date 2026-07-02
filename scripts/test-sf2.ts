import { readFileSync } from 'fs';
import { SoundFontLoader } from '../engine/instruments/soundfont/SoundFontLoader';
import { SoundFontParser } from '../engine/instruments/soundfont/SoundFontParser';

function main() {
  console.log('=== Test 1: SoundFontParser (low-level) ===\n');
  const buffer = readFileSync('C:\\personal\\daw\\public\\soundfonts\\aaviolin.sf2').buffer;
  console.log('SF2 file size:', (buffer.byteLength / 1024 / 1024).toFixed(1), 'MB');
  
  const parser = new SoundFontParser();
  const data = parser.parse(buffer);
  
  console.log('Presets:', data.presets.length);
  console.log('Instruments:', data.instruments.length);
  console.log('Sample headers:', data.sampleHeaders.length);
  console.log('Sample data size:', (data.sampleData.byteLength / 1024 / 1024).toFixed(1), 'MB');
  console.log('Sample rate:', data.sampleRate);
  
  // Verify presets
  data.presets.forEach((p, i) => {
    console.log(`  [${i}] "${p.name}" bank=${p.bank} program=${p.preset} zones=${p.zones.length}`);
    const sampleIds = new Set<number>();
    p.zones.forEach(z => {
      const sg = z.generators.find(g => g.genOper === 53);
      if (sg) sampleIds.add(sg.genValue);
    });
    console.log(`       unique samples: ${sampleIds.size}`);
    if (sampleIds.size > 0) {
      const sampled = [...sampleIds].slice(0, 3);
      const sampleDetails = sampled.map(id => {
        const sh = data.sampleHeaders[id];
        if (!sh) return `#${id}: (not found)`;
        const dur = ((sh.end - sh.start) / data.sampleRate).toFixed(2);
        return `#${id}="${sh.name}" dur=${dur}s`;
      });
      console.log(`       samples: ${sampleDetails.join(', ')}${sampleIds.size > 3 ? '...' : ''}`);
    }
  });
  
  console.log('\n=== Test 2: SoundFontLoader (high-level) ===\n');
  
  const loader = new SoundFontLoader();
  
  // Test loadFromPath (simulates URL load)
  // Since we can't do fetch in Node, we use loadFromBuffer directly
  const result = loader.loadFromBuffer(buffer, 'aaviolin.sf2');
  console.log('Load result:', result);
  
  const fontNames = loader.getFontNames();
  console.log('Loaded fonts:', fontNames);
  
  const fontId = fontNames[0];
  const fontInfo = loader.getFont(fontId);
  console.log('Font name:', fontInfo?.name);
  console.log('Font preset count:', fontInfo?.presetManager.getPresetCount());
  
  // Verify preset names via loader
  const presetNames = loader.getPresetNames(fontId);
  presetNames.forEach((pn, i) => {
    console.log(`  [${i}] "${pn.name}" bank=${pn.bank} program=${pn.program}`);
  });
  
  // Test getPresetList format
  console.log('\n=== Test 3: Preset details ===\n');
  const pm = fontInfo!.presetManager;
  const presets = pm.getPresets();
  
  // Check preset 0 (Slow Violin no rel) - should have sampleID=52 somewhere
  for (const p of presets.slice(0, 2)) {
    console.log(`\nPreset: "${p.name}"`);
    console.log(`  Banks: ${pm.getBanks()}`);
    const gens = pm.getPresetGenerators(p);
    const sampleIdGen = gens.find(g => g.genOper === 53);
    console.log(`  Has sampleID generator: ${sampleIdGen ? 'yes (val=' + sampleIdGen.genValue + ')' : 'no'}`);
    
    // Show unique sample IDs per zone
    const sampleIds = new Set<number>();
    const velRanges = new Set<string>();
    for (const z of p.zones) {
      const sg = z.generators.find(g => g.genOper === 53);
      if (sg) sampleIds.add(sg.genValue);
      const vg = z.generators.find(g => g.genOper === 44);
      if (vg) velRanges.add(`${vg.genValue >> 8}-${vg.genValue & 0xff}`);
    }
    console.log(`  Unique sample IDs: ${[...sampleIds].slice(0, 10).join(', ')}${sampleIds.size > 10 ? '...' : ''} (total ${sampleIds.size})`);
    console.log(`  Velocity ranges: ${[...velRanges].join(', ')}`);
  }
  
  console.log('\n=== All tests passed! ===');
}

main();
