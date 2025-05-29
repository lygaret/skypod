export type Replace<T, K extends keyof T, U> = Omit<T, K> & { [P in K]: U }
