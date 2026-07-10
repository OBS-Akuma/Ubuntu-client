const rpc = require("discord-rpc");

class DiscordRPC {
  constructor() {
    this.clientId = "1525194269545988178"; // Replace with your Discord App ID
    this.startTimestamp = Date.now();
    this.client = new rpc.Client({ transport: "ipc" });
    this.isReady = false;
    this.currentState = "In the lobby";
    this.currentDetails = "Playing Kirka.io";
    this.init();
  }

  init() {
    this.client.on("ready", () => {
      this.isReady = true;
      console.log("✅ Discord RPC ready");
      this.setActivity();
    });

    this.client.on("disconnected", () => {
      this.isReady = false;
      console.log("❌ Discord RPC disconnected, reconnecting...");
      setTimeout(() => this.login(), 5000);
    });

    this.login();
  }

  login() {
    this.client.login({ clientId: this.clientId }).catch((err) => {
      console.error("❌ Failed to connect to Discord RPC:", err);
    });
  }

  setActivity(activity = this.defaultActivity()) {
    if (!this.isReady) return;
    this.client.setActivity(activity).catch((err) => {
      console.error("❌ Failed to set activity:", err);
    });
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;
    const activity = this.defaultActivity();
    activity.state = state;
    this.setActivity(activity);
  }

  setDetails(details) {
    if (this.currentDetails === details) return;
    this.currentDetails = details;
    const activity = this.defaultActivity();
    activity.details = details;
    this.setActivity(activity);
  }

  setKillCount(kills) {
    this.setDetails(`${kills} kills`);
  }

  defaultActivity() {
    return {
      startTimestamp: this.startTimestamp,
      state: this.currentState,
      details: this.currentDetails,
      largeImageKey: "ubuntu_icon",
      largeImageText: "Ubuntu Client",
      smallImageKey: "kirka_icon",
      smallImageText: "Kirka.io",
      instance: false,
      buttons: [
        { label: "Download Ubuntu Client", url: "https://ubuntuclient.xyz" },
        { label: "Discord", url: "https://discord.gg/r6S3mMyT4K" }
      ]
    };
  }
}

module.exports = DiscordRPC;