import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";
import { EMAIL_FORMAT } from "../constants";

export const validateRegister = (options: UsernamePasswordInput) => {
  if (!EMAIL_FORMAT.test(options.email)) {
    return [
      {
        field: "email",
        message: "invalid email",
      },
    ];
  }
  if (options.username.length <= 2) {
    return [
      {
        field: "username",
        message: "length must be greater than 2",
      },
    ];
  }
  if (options.username.includes("@")) {
    return [
      {
        field: "username",
        message: "cannot include an @",
      },
    ];
  }
  if (options.password.length <= 3) {
    return [
      {
        field: "password",
        message: "length must be greater than 4",
      },
    ];
  }
  return null;
};
