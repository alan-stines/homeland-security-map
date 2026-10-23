/* Viewing envelopes include nearby offshore and border events; not jurisdiction boundaries. */
(function(root) {
  const regions = [
    {id:'conus', name:'Contiguous US', bounds:[-125,24,-66,50]},
    {id:'alaska', name:'Alaska', bounds:[-180,50,-129,72]},
    {id:'aleutians', name:'Western Aleutians', bounds:[170,50,180,55]},
    {id:'hawaii', name:'Hawaii', bounds:[-161,18,-154,23]},
    {id:'caribbean', name:'Puerto Rico & USVI', bounds:[-68.5,17,-64,19.5]},
    {id:'pacific', name:'Guam & Northern Marianas', bounds:[143,12,147,21]},
    {id:'samoa', name:'American Samoa', bounds:[-172,-15.5,-168,-10.5]}
  ];
  if (typeof module !== 'undefined') module.exports = regions;
  else root.US_REGIONS = regions;
})(typeof window === 'undefined' ? globalThis : window);
