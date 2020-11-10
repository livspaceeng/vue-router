export function checkMFEProperties (obj) {
  for (var key in obj) {
    if (obj[key] === null || obj[key] === '' || obj[key] === undefined) { return false }
  }
  return true
}
