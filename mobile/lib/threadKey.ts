/** A thread key uniquely identifies a conversation as (dinner, counterpart) — NOT just dinner_id.
 *  A dinner can host several independent conversations (a host with multiple approved attendees, or
 *  a host talking to both attendees and sponsors on the same dinner), so dinner_id alone collapses
 *  distinct conversations together. Lives in its own module (not lib/api.ts) so data/mock.ts can use
 *  it too without a circular import. */
export function threadKey(dinnerId: string, counterpartId: string): string {
  return `${dinnerId}:${counterpartId}`;
}
