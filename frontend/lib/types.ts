export interface DriverRow {
  driver: string
  compound: string
  tyre_age: number
  position: number
  is_threat: boolean
}

export interface DriverState {
  driver: string
  compound: string
  tyre_age: number
  position: number
  gap_to_leader: number
}
