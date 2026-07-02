import { LoudnessMeter, LoudnessData } from './loudnessMeter'
import { MasteringChainState } from './masteringChain'

export class MasteringProcessor {
  private audioContext: AudioContext

  inputNode!: GainNode
  private eqLowShelf!: BiquadFilterNode
  private eqLowMid!: BiquadFilterNode
  private eqHighMid!: BiquadFilterNode
  private eqHighShelf!: BiquadFilterNode
  private crossoverLow!: BiquadFilterNode
  private crossoverHigh!: BiquadFilterNode
  private compLow!: DynamicsCompressorNode
  private compMid!: DynamicsCompressorNode
  private compHigh!: DynamicsCompressorNode
  private steroWidthNode!: GainNode
  private dcFilterNode!: BiquadFilterNode
  outputNode!: GainNode

  private loudnessMeter!: LoudnessMeter
  private state!: MasteringChainState

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.createGraph()
  }

  private createGraph(): void {
    const ctx = this.audioContext

    this.inputNode = ctx.createGain()
    this.inputNode.gain.value = 1

    this.eqLowShelf = ctx.createBiquadFilter()
    this.eqLowShelf.type = 'lowshelf'
    this.eqLowShelf.frequency.value = 60
    this.eqLowShelf.gain.value = 0

    this.eqLowMid = ctx.createBiquadFilter()
    this.eqLowMid.type = 'peaking'
    this.eqLowMid.frequency.value = 250
    this.eqLowMid.Q.value = 0.7
    this.eqLowMid.gain.value = 0

    this.eqHighMid = ctx.createBiquadFilter()
    this.eqHighMid.type = 'peaking'
    this.eqHighMid.frequency.value = 4000
    this.eqHighMid.Q.value = 0.7
    this.eqHighMid.gain.value = 0

    this.eqHighShelf = ctx.createBiquadFilter()
    this.eqHighShelf.type = 'highshelf'
    this.eqHighShelf.frequency.value = 12000
    this.eqHighShelf.gain.value = 0

    this.crossoverLow = ctx.createBiquadFilter()
    this.crossoverLow.type = 'lowpass'
    this.crossoverLow.frequency.value = 200

    this.crossoverHigh = ctx.createBiquadFilter()
    this.crossoverHigh.type = 'highpass'
    this.crossoverHigh.frequency.value = 2000

    this.compLow = ctx.createDynamicsCompressor()
    this.compLow.threshold.value = -20
    this.compLow.ratio.value = 3
    this.compLow.attack.value = 0.005
    this.compLow.release.value = 0.1
    this.compLow.knee.value = 6

    this.compMid = ctx.createDynamicsCompressor()
    this.compMid.threshold.value = -24
    this.compMid.ratio.value = 2.5
    this.compMid.attack.value = 0.005
    this.compMid.release.value = 0.1
    this.compMid.knee.value = 6

    this.compHigh = ctx.createDynamicsCompressor()
    this.compHigh.threshold.value = -18
    this.compHigh.ratio.value = 3
    this.compHigh.attack.value = 0.003
    this.compHigh.release.value = 0.08
    this.compHigh.knee.value = 6

    this.steroWidthNode = ctx.createGain()
    this.steroWidthNode.gain.value = 1

    this.dcFilterNode = ctx.createBiquadFilter()
    this.dcFilterNode.type = 'highpass'
    this.dcFilterNode.frequency.value = 20

    this.outputNode = ctx.createGain()
    this.outputNode.gain.value = 1

    this.connectGraph()
  }

  private connectGraph(): void {
    this.inputNode.connect(this.eqLowShelf)
    this.eqLowShelf.connect(this.eqLowMid)
    this.eqLowMid.connect(this.eqHighMid)
    this.eqHighMid.connect(this.eqHighShelf)

    this.eqHighShelf.connect(this.steroWidthNode)
    this.steroWidthNode.connect(this.dcFilterNode)
    this.dcFilterNode.connect(this.outputNode)
  }

  initMeter(): void {
    if (this.loudnessMeter) return
    this.loudnessMeter = new LoudnessMeter(this.audioContext, this.outputNode, {
      updateInterval: 200,
      peakHoldDuration: 3000,
      clipThreshold: -1,
    })
    this.loudnessMeter.start((_data: LoudnessData) => {})
  }

  applyState(state: MasteringChainState): void {
    this.state = state

    this.eqLowShelf.frequency.value = state.eq.lowShelfFreq
    this.eqLowShelf.gain.value = state.eq.lowShelfGain
    this.eqLowMid.frequency.value = state.eq.lowMidFreq
    this.eqLowMid.Q.value = state.eq.lowMidQ
    this.eqLowMid.gain.value = state.eq.lowMidGain
    this.eqHighMid.frequency.value = state.eq.highMidFreq
    this.eqHighMid.Q.value = state.eq.highMidQ
    this.eqHighMid.gain.value = state.eq.highMidGain
    this.eqHighShelf.frequency.value = state.eq.highShelfFreq
    this.eqHighShelf.gain.value = state.eq.highShelfGain

    this.crossoverLow.frequency.value = state.multiband.crossoverLow
    this.crossoverHigh.frequency.value = state.multiband.crossoverMid
    this.compLow.threshold.value = state.multiband.lowThreshold
    this.compLow.ratio.value = state.multiband.lowRatio
    this.compMid.threshold.value = state.multiband.midThreshold
    this.compMid.ratio.value = state.multiband.midRatio
    this.compHigh.threshold.value = state.multiband.highThreshold
    this.compHigh.ratio.value = state.multiband.highRatio

    const width = Math.max(0, Math.min(2, state.stereoWidth))
    this.steroWidthNode.gain.value = width

    this.dcFilterNode.frequency.value = state.dcOffsetFilter ? 20 : 10
  }

  getLoudnessData(): LoudnessData {
    return this.loudnessMeter ? this.loudnessMeter.getCurrentData() : {
      momentary: -Infinity,
      shortTerm: -Infinity,
      integrated: -Infinity,
      truePeakLeft: -Infinity,
      truePeakRight: -Infinity,
      loudnessRange: 0,
      peakHoldLeft: -Infinity,
      peakHoldRight: -Infinity,
      clipLeft: false,
      clipRight: false,
    }
  }

  resetLoudness(): void {
    if (!this.loudnessMeter) return
    this.loudnessMeter.resetIntegrated()
    this.loudnessMeter.resetPeakHold()
  }

  setMeterCallback(callback: (data: LoudnessData) => void): void {
    this.initMeter()
    this.loudnessMeter.start(callback)
  }

  bypassEQ(bypassed: boolean): void {
    if (bypassed) {
      this.eqLowShelf.gain.value = 0
      this.eqLowMid.gain.value = 0
      this.eqHighMid.gain.value = 0
      this.eqHighShelf.gain.value = 0
    } else if (this.state) {
      this.applyState(this.state)
    }
  }

  getOutputNode(): GainNode {
    return this.outputNode
  }

  getInputNode(): GainNode {
    return this.inputNode
  }

  dispose(): void {
    if (this.loudnessMeter) {
      this.loudnessMeter.stop()
      this.loudnessMeter.dispose()
    }
    this.inputNode.disconnect()
    this.eqLowShelf.disconnect()
    this.eqLowMid.disconnect()
    this.eqHighMid.disconnect()
    this.eqHighShelf.disconnect()
    this.crossoverLow.disconnect()
    this.crossoverHigh.disconnect()
    this.compLow.disconnect()
    this.compMid.disconnect()
    this.compHigh.disconnect()
    this.steroWidthNode.disconnect()
    this.dcFilterNode.disconnect()
    this.outputNode.disconnect()
  }
}

export function createMasteringProcessor(audioContext: AudioContext): MasteringProcessor {
  return new MasteringProcessor(audioContext)
}

export default MasteringProcessor
