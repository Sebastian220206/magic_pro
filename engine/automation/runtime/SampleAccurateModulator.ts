export class SampleAccurateModulator {
  public static fillBuffer(
    output: Float32Array,
    startValue: number,
    endValue: number
  ) {
    const delta = (endValue - startValue) / output.length;

    for (let i = 0; i < output.length; i++) {
      output[i] = startValue + delta * i;
    }
  }
}
