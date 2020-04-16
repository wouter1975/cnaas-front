import React from "react";
import ConfigChangeStep1 from "./ConfigChangeStep1";
import DryRun from "./DryRun/DryRun";
import VerifyDiff from "./VerifyDiff/VerifyDiff";
import ConfigChangeStep4 from "./ConfigChangeStep4";
import checkResponseStatus from "../../utils/checkResponseStatus";
// import { postData } from "../../utils/sendData";
import getData from "../../utils/getData";

class ConfigChange extends React.Component {
  state = {
    dryRunSyncData: [],
    dryRunSyncJobid: null,
    dryRunProgressData: [],
    dryRunResultData: [],
    dryRunTotalCount: 0,
    liveRunSyncData: [],
    liveRunSyncJobid: null,
    liveRunProgressData: [],
    liveRunResultData: [],
    liveRunTotalCount: 0
  };

  readHeaders = (response, dry_run) => {
    const totalCountHeader = response.headers.get("X-Total-Count");
    if (totalCountHeader !== null && !isNaN(totalCountHeader)) {
      console.log("total: " + totalCountHeader);
      if (dry_run === true) {
        this.setState({ dryRunTotalCount: totalCountHeader });
      } else {
        this.setState({ liveRunTotalCount: totalCountHeader });
      }
    } else {
      console.log("Could not find X-Total-Count header, only showing one page");
    }
    return response;
  };

  deviceSyncStart = (options) => {
    console.log("Starting sync devices");
    const credentials = localStorage.getItem("token");
    let url = process.env.API_URL + "/api/v1.0/device_syncto";
    let dataToSend = { dry_run: true, all: true };
   
    if (options !== undefined) {
      if (options.resync !== undefined) {
        dataToSend["resync"] = options.resync;
      }
      if (options.force !== undefined) {
        dataToSend["force"] = options.force;
      }
      if (options.dry_run !== undefined) {
        dataToSend["dry_run"] = options.dry_run;
      }
    } else {
     options = {};
    }

    if (dataToSend["dry_run"] === false) {
      console.log("sync live run");
      dataToSend["force"] = true;
    }

    console.log("now it will post the data: "+JSON.stringify(dataToSend));
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials}`
      },
      body: JSON.stringify(dataToSend)
    })
      .then(response => checkResponseStatus(response))
      .then(response => this.readHeaders(response, dataToSend["dry_run"]))
      .then(response => response.json())
      .then(data => {
        console.log("this should be data", data);
        {
          if (dataToSend["dry_run"] === true) {
            this.setState(
              {
                dryRunSyncData: data
              },
              () => {
                this.pollJobStatus(data.job_id, true);
              },
              () => {
                console.log("this is new state", this.state.dryRunSyncData);
              }
            );
          } else {
            this.setState(
              {
                liveRunSyncData: data
              },
              () => {
                this.pollJobStatus(data.job_id, false);
              },
              () => {
                console.log("this is new state", this.state.liveRunSyncData);
              }
            );
          }
        }
      });
  };

  pollJobStatus = (job_id, dry_run) => {
    const credentials = localStorage.getItem("token");
    let url = process.env.API_URL + `/api/v1.0/job/${job_id}`;

    if (dry_run === true) {
      this.repeatingDryrunJobData = setInterval(() => {
        getData(url, credentials).then(data => {
          {
            this.setState({
              dryRunProgressData: data.data.jobs
            });
          }
        });
      }, 1000);
    } else {
      this.repeatingLiverunJobData = setInterval(() => {
        getData(url, credentials).then(data => {
          {
            this.setState({
              liveRunProgressData: data.data.jobs
            });
          }
        });
      }, 1000);
    }
  };

  render() {
    let dryRunProgressData = this.state.dryRunProgressData;
    let dryRunJobStatus = "";
    let dryRunResults = "";
    let dryRunChangeScore = "";
    let liveRunProgressData = this.state.liveRunProgressData;
    let liveRunJobStatus = "";
    let liveRunResults = "";

    dryRunProgressData.map((job, i) => {
      dryRunJobStatus = job.status;
      dryRunChangeScore = job.change_score;
    });

    if (dryRunJobStatus === "FINISHED" || dryRunJobStatus === "EXCEPTION") {
      clearInterval(this.repeatingDryrunJobData);
      if (dryRunJobStatus === "FINISHED") {
        dryRunProgressData.map((job, i) => {
          dryRunResults = job.result.devices;
        });
        var confirmButtonElem = document.getElementById("confirmButton");
        confirmButtonElem.disabled = false;
      }
    }

    liveRunProgressData.map((job, i) => {
      liveRunJobStatus = job.status;
    });

    if (liveRunJobStatus === "FINISHED" || liveRunJobStatus === "EXCEPTION") {
      clearInterval(this.repeatingLiverunJobData);
      if (liveRunJobStatus === "FINISHED") {
        liveRunProgressData.map((job, i) => {
          liveRunResults = job.result.devices;
        });
      }
    }

    return (
      <section>
        <h1>Commit changes task</h1>
        <ConfigChangeStep1 />
        <DryRun
          dryRunSyncStart={this.deviceSyncStart}
          dryRunProgressData={dryRunProgressData}
          dryRunJobStatus={dryRunJobStatus}
          devices={dryRunResults}
          totalCount={this.state.dryRunTotalCount}
        />
        <VerifyDiff
          dryRunChangeScore={dryRunChangeScore}
          devices={dryRunResults}
        />
        <ConfigChangeStep4
          dryRunSyncStart={this.deviceSyncStart}
          dryRunProgressData={liveRunProgressData}
          dryRunJobStatus={liveRunJobStatus}
          devices={liveRunResults}
          totalCount={this.state.liveRunTotalCount}
        />
      </section>
    );
  }
}

export default ConfigChange;
