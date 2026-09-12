// Profile revisions describe reference data, not the physical PCB revision.
const profiles = [{ id: 'nodemcu-amica-esp12e-cp2102', revision: 1 }];

exports.isValid = value => value === null || (
  value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === 2 &&
  profiles.some(profile => profile.id === value.id && profile.revision === value.revision)
);
