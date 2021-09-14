(async() => {

    const { connect, StringCodec, Subscription } = require("nats");
    const RPI={
        EVENTS:{
            ON:"ON",
            OFF:"OFF"
        }
    }

    // create a connection
    const nc = await connect({ servers: "nats://192.168.18.172:4222" });
    if(nc){
        console.log("connected to nats");
    };

    // create a codec
    const sc = StringCodec();

    // this subscription listens for `time` requests and returns the current time
    const sub = nc.subscribe("RPI");
    (async (sub) => {
        console.log(`listening for ${sub.getSubject()} requests...`);
        for await (const m of sub) {
            if (m.respond(sc.encode("RPI is Listening:s "+new Date().toISOString()))) {
            console.info(`[RPI] handled #${sub.getProcessed()}`);
            } else {
            console.log(`[time] #${sub.getProcessed()} ignored - no reply subject`);
            }
        }
        console.log(`subscription ${sub.getSubject()} drained.`);
    })(sub);

    // this subscription listens for admin.uptime and admin.stop
    // requests to admin.uptime returns how long the service has been running
    // requests to admin.stop gracefully stop the client by draining
    // the connection
    const started = Date.now();
    const msub = nc.subscribe("RPI.EVENTS.*");
    (async (sub) => {
        console.log(`listening for ${sub.getSubject()} requests [ON | OFF]`);
        // it would be very good to verify the origin of the request
        // before implementing something that allows your service to be managed.
        // NATS can limit which client can send or receive on what subjects.
        for await (const m of sub) {
            // console.log(m)
            const chunks = m.subject.split(".");
            console.info(`[RPI] #${sub.getProcessed()} handling ${chunks[1]}`);
            switch (chunks[1]) {
            case RPI.EVENTS.ON:
                // send the number of millis since up
                m.respond(sc.encode(`${Date.now() - started}`));
                break;
            case RPI.EVENTS.OFF: {
                m.respond(sc.encode(`[RPI] #${sub.getProcessed()} stopping....`));
                // gracefully shutdown
                nc.drain()
                .catch((err) => {
                    console.log("error draining", err);
                });
                break;
            }
            default:
                console.log(
                `[RPI] #${sub.getProcessed()} ignoring request for ${m.subject}`,
                );
            }
    }
    console.log(`subscription ${sub.getSubject()} drained.`);
    })(msub);

    // wait for the client to close here.
    await nc.closed().then((err) => {
    let m = `connection to ${nc.getServer()} closed`;
    if (err) {
        m = `${m} with an error: ${err.message}`;
    }
    console.log(m);
    });
})();