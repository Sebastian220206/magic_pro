export {
    createMarqueeSelection,
    mergeMarqueeSelections,
    isBeatInMarqueeRange,
    isClipInMarqueeRange,
    getMarqueeDuration,
    marqueeSelectionEquals
} from './MarqueeSelectionManager';

export type {
    ExtendedMarqueeSelection
} from './MarqueeSelectionManager';

export {
    selectClipsInRange,
    selectLanesInRange,
    deleteClipsInRange,
    moveClipsInRange,
    splitClipAtBeat,
    splitClipsAtMarqueeBounds,
    getMarqueeRangeClippedCopy,
    deleteTimeInRange,
    insertTimeAtBeat,
    setLoopToMarquee,
    playMarqueeRange
} from './RangeOperations';
