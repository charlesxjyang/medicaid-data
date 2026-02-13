import { useDashboard } from "../../store/dashboard";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

export function StateFilter() {
  const { selectedState, setSelectedState } = useDashboard();

  return (
    <div className="filter-group">
      <label htmlFor="state-filter">State</label>
      <select
        id="state-filter"
        value={selectedState ?? ""}
        onChange={(e) => setSelectedState(e.target.value || null)}
      >
        <option value="">All States</option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
