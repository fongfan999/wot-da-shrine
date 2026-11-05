# Deploys and the watch

## Bless a deploy

Incidents are rare and deploys are daily, so a shrine is worth opening before
anything breaks. With nothing down, **Bless a deploy** in the top bar asks what
is shipping (optional) and starts a *blessing*: the heading says "Shipping
payments-api v2.3", a clock counts up in the corner, and the room's bows and
prayers count toward it. It ends one of two ways:

- **Shipped**: bells, +5 karma, and the heading says it shipped clean for a
  minute. The room's clean run goes on.
- **It broke**: the vigil opens at once, named after the deploy ("Payments-api
  v2.3 broke"), with the team already kneeling. The clean run starts again.

A vigil that opens within 30 minutes of a Shipped counts against that deploy:
the shrine marks it broke and the clean run starts again, so a streak means
something. One blessing at a time, never during a vigil (then the vigil is the
prayer), and one nobody ends within two hours is filed as never said, which
neither keeps nor breaks the run. The **Shrine records** card shows deploys
blessed and the clean run once there is one; the quiet TV says how many clean
deploys in a row, and a pasted link mentions a blessing in progress. The rules
live in `shared/rules.js` with the vigil's.

**The omens.** Before anything goes out, the Bless a deploy prompt reads
them: it is Friday, the weekend or after 4 pm (by the deployer's clock),
nobody has bowed today, the kami is hungry, the last deploy broke, something
went down in the last day, the moon is full, Mercury is retrograde. Someone
having bowed today, a pleased kami and a clean run of three weigh against
them, and a verdict runs from *Auspicious. Ship it.* to *Absolutely not. Well,
it is your deploy.* At three or more against, Bless it reads **Ship anyway**.
Nothing is ever stopped. The shrine reads the same omens when the blessing
starts and keeps the bad ones on it: the heading says what it went out
against, It broke then says the omens did say, and shipping clean against
three or more earns the **Defiant** charm. The omens are in `shared/omens.js`;
the Mercury dates there run to the end of 2027.

## The watch

Someone is on call every night, so the shrine keeps a lantern for them. Under
the heading, **Take the watch** makes you the one holding the pager; whoever
holds it sees **Hand over**, which lists everyone kneeling in the shrine and
passes it to them ("An handed you the watch. Sleep lightly."), or ends the
watch. Anyone else can **Take over**. One holder at a time, and the holder
kneels at the altar with a lantern on their name tag.

- **A quiet watch**: a watch that saw no vigil and lasted an hour or more
  earns the room +10 karma and a peal of bells when it is handed on or ended.
  Taking the watch during an incident inherits it, so that watch is not quiet.
- **On whose watch**: a vigil that opens while someone holds the pager says so
  in its corner ("on Linh's watch"), and its record keeps the name.
- **On the TV**: the war-room screen shows who is on call and since when, and
  shows nothing when nobody is.

The holder is matched by connection, or by name and avatar, so the same person
on their phone the next morning still holds it. A watch nobody hands on is let
go after a week. **Shrine records** counts the quiet watches once one has
ended. Holders' names stay in the room: link previews and badges never show
them.
